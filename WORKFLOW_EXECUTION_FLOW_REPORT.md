# Workflow Execution Flow - Detailed Technical Report

## Example: Gmail Email Received → Slack Message Workflow

This document provides a comprehensive, end-to-end technical explanation of how a workflow operates in the system, from user authentication to workflow execution.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Phase 1: User Authentication & Registration](#phase-1-user-authentication--registration)
3. [Phase 2: OAuth App Connection](#phase-2-oauth-app-connection)
4. [Phase 3: Workflow Creation](#phase-3-workflow-creation)
5. [Phase 4: Background Polling (Scheduler)](#phase-4-background-polling-scheduler)
6. [Phase 5: Workflow Execution (Queue & Processor)](#phase-5-workflow-execution-queue--processor)
7. [Phase 6: Trigger Detection & Data Flow](#phase-6-trigger-detection--data-flow)
8. [Phase 7: Action Execution](#phase-7-action-execution)
9. [Logging & Monitoring](#logging--monitoring)
10. [Error Handling & Retry Mechanism](#error-handling--retry-mechanism)
11. [Code Flow Diagram](#code-flow-diagram)

---

## System Overview

The workflow system is built on **NestJS** with the following key components:

- **Authentication**: JWT-based authentication with bcrypt password hashing
- **OAuth Integration**: Connects Gmail, Slack, GitHub via OAuth 2.0
- **Workflow Management**: CRUD operations for workflows with step-based execution
- **Background Scheduler**: Polls active workflows every 30 seconds
- **Queue System**: BullMQ (Redis-based) for asynchronous job processing
- **Worker Processor**: Executes workflows with retry logic (3 attempts with exponential backoff)
- **Logging System**: Tracks all workflow events for debugging and monitoring

---

## Phase 1: User Authentication & Registration

### 1.1 User Registration

**File**: `src/users/users.service.ts` → `create()` method

```typescript
// User signs up with email and password
POST /api/auth/register
Body: {
  email: "user@example.com",
  password: "securepassword",
  confirmPassword: "securepassword"
}
```

**Flow**:

1. `UsersService.create()` is called with user data
2. Password is hashed using bcrypt (10 salt rounds)
3. User record is created in database with:
   - `email`
   - `password` (hashed)
   - `provider: 'normal'`
4. User ID is generated and returned

**Database**: `user` table created with columns:

- `id` (auto-increment primary key)
- `email` (unique)
- `password` (hashed)
- `provider` ('normal' or 'google')
- `providerId` (for OAuth users)

---

### 1.2 User Login

**File**: `src/auth/auth.controller.ts` → `login()` method

```typescript
POST /api/auth/login
Body: {
  email: "user@example.com",
  password: "securepassword"
}
```

**Flow**:

1. `UsersService.findUserByEmail()` retrieves user from database
2. `AuthService.validatePassword()` compares plaintext password with hashed password
3. If valid, `JwtService.generateToken()` creates JWT token with payload:
   ```typescript
   { id: user.id, email: user.email }
   ```
4. Token is returned to frontend (expires in configured time)

**Response**:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

---

## Phase 2: OAuth App Connection

Users must connect their Gmail and Slack accounts before creating workflows.

### 2.1 Initiating OAuth Flow (Gmail)

**File**: `src/oauth/oauth.controller.ts` → `redirectToApp()` method

```typescript
GET /api/oauth/gmail?userId=1
```

**Flow**:

1. Backend constructs OAuth URL with:
   - Client ID (from `GOOGLE_CLIENT_ID` env variable)
   - Redirect URI (from `GOOGLE_REDIRECT_URI`)
   - Scopes: `https://www.googleapis.com/auth/gmail.readonly`, `gmail.send`, `gmail.modify`
   - State parameter: `userId` (for security)
2. User is redirected to Google's consent screen
3. User approves permissions

---

### 2.2 OAuth Callback (Gmail)

**File**: `src/oauth/oauth.controller.ts` → `handleCallback()` method

```typescript
GET /api/oauth/callback/gmail?code=AUTH_CODE&state=1
```

**Flow**:

1. Google redirects back with `code` and `state`
2. `OauthService.exchangeCodeForTokens()` exchanges code for tokens:
   ```typescript
   POST https://oauth2.googleapis.com/token
   Body: {
     client_id: "...",
     client_secret: "...",
     code: "AUTH_CODE",
     grant_type: "authorization_code",
     redirect_uri: "..."
   }
   ```
3. Google returns:
   ```json
   {
     "access_token": "ya29.a0AfH6SMB...",
     "refresh_token": "1//0gK...",
     "expires_in": 3600,
     "scope": "https://www.googleapis.com/auth/gmail.readonly ...",
     "token_type": "Bearer"
   }
   ```
4. `OauthService.saveUserApp()` stores tokens in database:
   - **Table**: `user_app`
   - **Fields**:
     - `userId`: 1
     - `appName`: "gmail"
     - `accessToken`: "ya29.a0AfH6SMB..."
     - `refreshToken`: "1//0gK..."
     - `expiresAt`: timestamp (current time + 3600 seconds)
     - `metadata`: full OAuth response

---

### 2.3 Connecting Slack (Same Process)

```typescript
GET /api/oauth/slack?userId=1
// ... Similar OAuth flow ...
GET /api/oauth/callback/slack?code=...&state=1
```

**Result**: Both Gmail and Slack credentials are now stored in `user_app` table.

---

## Phase 3: Workflow Creation

### 3.1 Frontend Creates Workflow

**File**: `src/workflows/workflows.controller.ts` → `createWorkflow()` method

```typescript
POST /api/workflows
Headers: {
  Authorization: "Bearer JWT_TOKEN"
}
Body: {
  "workflow": {
    "workflowName": "Gmail to Slack Notifier",
    "description": "Send Slack message when new email is received",
    "steps": [
      {
        "id": "1",
        "type": "trigger",
        "appName": "gmail",
        "triggerId": "new_email",
        "config": {
          "query": "is:unread newer_than:2d"
        }
      },
      {
        "id": "2",
        "type": "condition",
        "condition": {
          "field": "trigger.from",
          "operator": "contains",
          "value": "@important.com"
        },
        "onTrue": "3",
        "onFalse": null
      },
      {
        "id": "3",
        "type": "action",
        "appName": "slack",
        "actionId": "send_message",
        "config": {
          "channel": "C12345",
          "text": "New email from {{trigger.from}}: {{trigger.subject}}"
        },
        "next": null
      }
    ]
  }
}
```

---

### 3.2 Backend Processing

**File**: `src/workflows/workflows.service.ts` → `create()` method

**Flow**:

1. **JWT Authentication**: `AuthGuard` validates JWT token and injects `user` object
2. **Validation**:
   ```typescript
   - Checks workflow.steps exists
   - Validates at least one trigger step
   - Validates at least one action step
   - Checks for duplicate workflow names
   ```
3. **Database Record Creation**:
   ```typescript
   const workflow = this.workflowsRepo.create({
     name: "Gmail to Slack Notifier",
     description: "Send Slack message...",
     steps: [...], // JSON field
     user: { id: 1 },
     isActive: false, // Not active yet
     pollingInterval: null,
     lastRunAt: null
   });
   await this.workflowsRepo.save(workflow);
   ```
4. **Logging**: Creates log entry with event type `WORKFLOW_CREATED`
5. **Auto-Activation**: Immediately calls `activateWorkflow()`

---

### 3.3 Workflow Activation

**File**: `src/workflows/workflows.service.ts` → `activateWorkflow()` method

**Flow**:

1. Retrieves workflow from database
2. Determines polling interval based on trigger type:
   ```typescript
   getPollingInterval(appName: string): number {
     const intervals = {
       gmail: 60,   // 60 seconds
       slack: 30,   // 30 seconds
       github: 60,  // 60 seconds
     };
     return intervals[appName] || 60;
   }
   ```
3. Updates workflow record:
   ```typescript
   workflow.isActive = true;
   workflow.lastRunAt = undefined; // Will run immediately
   workflow.pollingInterval = 60; // seconds
   await this.workflowsRepo.save(workflow);
   ```
4. Logs `WORKFLOW_ACTIVATED` event

**Database State**:

```json
{
  "id": 1,
  "name": "Gmail to Slack Notifier",
  "isActive": true,
  "pollingInterval": 60,
  "lastRunAt": null,
  "steps": [...]
}
```

---

## Phase 4: Background Polling (Scheduler)

The scheduler runs continuously in the background, checking active workflows.

### 4.1 Scheduler Initialization

**File**: `src/main.ts` → `bootstrap()` function

```typescript
const schedulerService = app.get(SchedulerService);
schedulerService.startPolling();
console.log('Workflow scheduler started');
```

**File**: `src/queue/scheduler.service.ts` → `startPolling()` method

```typescript
startPolling(): void {
  // Poll every 30 seconds
  this.pollingIntervalId = setInterval(() => {
    this.pollWorkflows();
  }, 30000);

  // Run immediately on start
  this.pollWorkflows();
}
```

---

### 4.2 Polling Loop

**File**: `src/queue/scheduler.service.ts` → `pollWorkflows()` method

**Every 30 seconds, the following happens**:

```typescript
private async pollWorkflows(): Promise<void> {
  console.log('Polling active workflows...');

  // 1. Fetch all active workflows
  const activeWorkflows = await this.workflowRepo.find({
    where: { isActive: true },
    relations: ['user'], // Load user for OAuth tokens
  });

  console.log(`Found ${activeWorkflows.length} active workflows`);

  // 2. Check each workflow
  for (const workflow of activeWorkflows) {
    await this.checkAndTriggerWorkflow(workflow);
  }
}
```

---

### 4.3 Checking Individual Workflow

**File**: `src/queue/scheduler.service.ts` → `checkAndTriggerWorkflow()` method

```typescript
private async checkAndTriggerWorkflow(workflow: Workflow): Promise<void> {
  const now = new Date();
  const nextRunAt = this.calculateNextRunAt(workflow);

  // Check if it's time to run (based on pollingInterval)
  if (nextRunAt > now) {
    return; // Not time yet
  }

  console.log(`Checking trigger for workflow ${workflow.id}`);

  // Check the actual trigger condition
  const triggerData = await this.checkTrigger(workflow);

  if (triggerData) {
    console.log(`Trigger fired for workflow ${workflow.id}`);

    // Log trigger fired event
    await this.loggingService.createLog(
      LogEventType.TRIGGER_FIRED,
      { workflowId: workflow.id, triggerData },
      workflow.user,
      workflow
    );

    // Add job to queue for execution
    await this.queueService.addWorkflowJob(
      workflow.id,
      workflow.user.id,
      triggerData
    );

    // Update lastRunAt to prevent immediate re-trigger
    await this.workflowRepo.update(workflow.id, {
      lastRunAt: now
    });
  }
}
```

**Polling Interval Logic**:

```typescript
private calculateNextRunAt(workflow: Workflow): Date {
  if (!workflow.lastRunAt) {
    return new Date(0); // Run immediately if never run
  }

  const pollingInterval = workflow.pollingInterval || 60; // seconds
  const nextRun = new Date(workflow.lastRunAt);
  nextRun.setSeconds(nextRun.getSeconds() + pollingInterval);
  return nextRun;
}
```

**Example Timeline**:

- `12:00:00` - Workflow created, lastRunAt = null → Run immediately
- `12:00:00` - Workflow checked, lastRunAt = 12:00:00
- `12:00:30` - Scheduler checks: nextRunAt = 12:01:00 > now (12:00:30) → Skip
- `12:01:00` - Scheduler checks: nextRunAt = 12:01:00 <= now (12:01:00) → Check trigger

---

## Phase 6: Trigger Detection & Data Flow

### 6.1 Checking Gmail Trigger

**File**: `src/queue/scheduler.service.ts` → `checkTrigger()` method

```typescript
private async checkTrigger(workflow: Workflow): Promise<any | null> {
  const triggerStep = workflow.steps?.find(step => step.type === 'trigger');
  const triggerId = triggerStep.triggerId; // "new_email"

  let newItems: any[] = [];

  switch (triggerId) {
    case 'new_email':
      newItems = await this.fetchNewEmails(workflow, triggerStep);
      break;
    // ... other trigger types ...
  }

  // Filter out already processed items
  const unprocessedItems = await this.filterUnprocessed(
    workflow.id,
    triggerId,
    newItems
  );

  // Return first unprocessed item (or null)
  return unprocessedItems.length > 0 ? unprocessedItems[0] : null;
}
```

---

### 6.2 Fetching New Emails

**File**: `src/queue/scheduler.service.ts` → `fetchNewEmails()` method

```typescript
private async fetchNewEmails(workflow: Workflow, triggerStep: any): Promise<any[]> {
  // Fetch unread emails from last 2 days
  const query = triggerStep.config?.query || 'is:unread newer_than:2d';

  const emails = await this.integrationsService.callGmailAPI(
    workflow.user,
    'fetchEmails',
    { query, maxResults: 10 }
  );

  // Sort by timestamp (newest first)
  emails.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Transform to trigger data format
  return emails.map(email => ({
    externalId: email.id,         // Gmail message ID
    triggerId: 'new_email',
    data: {
      trigger: {
        messageId: email.id,
        threadId: email.threadId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        body: email.body,
        snippet: email.snippet,
        timestamp: email.timestamp,
        labelIds: email.labelIds
      }
    }
  }));
}
```

**Gmail API Call** (`src/integrations/gmail.integration.ts`):

```typescript
async fetchRecentEmails(accessToken: string, query?: string): Promise<GmailEmail[]> {
  // 1. Get message IDs
  const listResponse = await axios.get(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { q: query, maxResults: 10 }
    }
  );

  // 2. Fetch details for each message
  const emails = [];
  for (const message of listResponse.data.messages) {
    const email = await this.getEmailDetails(accessToken, message.id);
    emails.push(email);
  }

  return emails;
}
```

---

### 6.3 Duplicate Prevention

**File**: `src/queue/scheduler.service.ts` → `filterUnprocessed()` method

```typescript
private async filterUnprocessed(
  workflowId: number,
  triggerType: string,
  items: any[]
): Promise<any[]> {
  // Get all previously processed external IDs
  const processedIds = await this.processedTriggerRepo.find({
    where: {
      workflow: { id: workflowId },
      triggerType
    },
    select: ['externalId']
  });

  const processedIdSet = new Set(processedIds.map(p => p.externalId));

  // Return only items not in the set
  return items.filter(item => !processedIdSet.has(item.externalId));
}
```

**Database**: `processed_trigger` table tracks:

- `workflowId`: 1
- `triggerType`: "new_email"
- `externalId`: "18c5d0e123456789" (Gmail message ID)
- `metadata`: full email data
- `processedAt`: timestamp

This ensures each email triggers the workflow **only once**.

---

## Phase 5: Workflow Execution (Queue & Processor)

### 5.1 Adding Job to Queue

**File**: `src/queue/queue.service.ts` → `addWorkflowJob()` method

```typescript
async addWorkflowJob(
  workflowId: number,
  userId: number,
  triggerData: any
): Promise<void> {
  await this.workflowQueue.add(
    'execute-workflow',
    {
      workflowId: 1,
      userId: 1,
      triggerData: {
        externalId: "18c5d0e123456789",
        triggerId: "new_email",
        data: {
          trigger: {
            messageId: "18c5d0e123456789",
            threadId: "18c5d0e123456789",
            from: "boss@important.com",
            subject: "Urgent: Review needed",
            body: "Please review the attached document...",
            timestamp: "2024-01-15T10:30:00Z"
          }
        }
      }
    },
    {
      attempts: 3,              // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 1000            // 1s, 2s, 4s delays
      },
      removeOnComplete: true,   // Auto-cleanup successful jobs
      removeOnFail: false       // Keep failed jobs for debugging
    }
  );

  console.log(`Added workflow job to queue: workflowId=${workflowId}`);
}
```

**Queue System**: Uses **BullMQ** (Redis-based) with:

- Queue name: `workflow-execution`
- Job name: `execute-workflow`
- Redis connection: `localhost:6379` (configurable)

---

### 5.2 Worker Processing

**File**: `src/queue/workflow.processor.ts` → `processWorkflow()` method

The worker runs continuously, picking up jobs from the queue:

```typescript
constructor() {
  this.worker = new Worker(
    'workflow-execution',
    async (job: Job) => {
      return await this.processWorkflow(job);
    },
    {
      connection: this.connection,
      concurrency: 5  // Process up to 5 workflows simultaneously
    }
  );
}

private async processWorkflow(job: Job): Promise<any> {
  const { workflowId, userId, triggerData } = job.data;
  const attemptNumber = job.attemptsMade; // 0, 1, or 2

  console.log(`Processing workflow ${workflowId} (attempt ${attemptNumber + 1}/3)`);

  // 1. Load workflow and user from database
  const workflow = await this.workflowRepo.findOne({
    where: { id: workflowId },
    relations: ['user']
  });

  const user = await this.userRepo.findOne({
    where: { id: userId }
  });

  // 2. Create WorkflowRun record (for tracking)
  let workflowRun = this.workflowRunRepo.create({
    workflow,
    status: 'running',
    triggerData,
    retryCount: attemptNumber,
    startedAt: new Date()
  });
  workflowRun = await this.workflowRunRepo.save(workflowRun);

  // 3. Log execution started
  await this.loggingService.createLog(
    LogEventType.WORKFLOW_EXECUTION_STARTED,
    {
      workflowId,
      workflowName: workflow.name,
      workflowRunId: workflowRun.id,
      attempt: attemptNumber + 1
    },
    user,
    workflow,
    workflowRun
  );

  try {
    // 4. Execute the workflow
    const executionResult = await this.workflowsService.executeWorkflow(
      workflowId,
      triggerData.data,
      workflowRun
    );

    // 5. Update run status to success
    workflowRun.status = 'success';
    workflowRun.finishedAt = new Date();
    workflowRun.executionLog = executionResult;
    await this.workflowRunRepo.save(workflowRun);

    // 6. Log completion
    await this.loggingService.createLog(
      LogEventType.WORKFLOW_EXECUTION_COMPLETED,
      {
        workflowId,
        executionTime: Date.now() - workflowRun.startedAt.getTime()
      },
      user,
      workflow,
      workflowRun
    );

    // 7. Record processed trigger (prevents duplicates)
    await this.processedTriggerRepo.save({
      workflow: { id: workflowId },
      triggerType: triggerData.triggerId,
      externalId: triggerData.externalId,
      metadata: triggerData.data
    });

    return { status: 'success', workflowRunId: workflowRun.id };

  } catch (error: any) {
    // 8. Handle failure
    console.error(`Workflow execution failed:`, error.message);

    workflowRun.status = 'failed';
    workflowRun.error = error.message;
    workflowRun.finishedAt = new Date();
    workflowRun.retryCount = attemptNumber + 1;
    await this.workflowRunRepo.save(workflowRun);

    // 9. Log failure
    await this.loggingService.createLog(
      LogEventType.WORKFLOW_EXECUTION_FAILED,
      {
        workflowId,
        error: error.message,
        attempt: attemptNumber + 1
      },
      user,
      workflow,
      workflowRun
    );

    // 10. Re-throw to trigger BullMQ retry (if attempts < 3)
    throw error;
  }
}
```

---

## Phase 7: Action Execution

### 7.1 Executing Workflow Steps

**File**: `src/workflows/workflows.service.ts` → `executeWorkflow()` method

```typescript
async executeWorkflow(
  workflowId: number,
  triggerData: any,
  workflowRun: any
): Promise<any[]> {
  // Load workflow
  const workflow = await this.workflowsRepo.findOne({
    where: { id: workflowId },
    relations: ['user']
  });

  const executionLog = await this.executeWorkflowSteps(
    workflow.user,
    workflow.steps,
    triggerData,
    workflow,
    workflowRun
  );

  return executionLog;
}
```

---

### 7.2 Step Execution with Conditional Logic

**File**: `src/workflows/workflows.service.ts` → `executeWorkflowSteps()` method

```typescript
private async executeWorkflowSteps(
  user: User,
  steps: any[],
  triggerData: any,
  workflow?: Workflow,
  workflowRun?: any
): Promise<any[]> {
  const executionLog: any[] = [];
  const stepMap = new Map(steps.map(step => [step.id, step]));

  // Find trigger step
  const triggerStep = steps.find(step => step.type === 'trigger');

  // Start with step after trigger (step 2 - the condition)
  let currentStepId = '2';

  while (currentStepId) {
    const currentStep = stepMap.get(currentStepId);

    if (!currentStep) break;

    console.log(`Executing step ${currentStepId}: ${currentStep.type}`);

    // CONDITION STEP
    if (currentStep.type === 'condition') {
      const nextStepId = this.evaluateCondition(currentStep, triggerData);

      executionLog.push({
        stepId: currentStepId,
        type: 'condition',
        result: nextStepId,
        message: `Condition evaluated, next step: ${nextStepId}`
      });

      currentStepId = nextStepId; // Jump to onTrue or onFalse
    }

    // ACTION STEP
    else if (currentStep.type === 'action') {
      // Log action started
      await this.loggingService.createLog(
        LogEventType.ACTION_STARTED,
        {
          stepId: currentStepId,
          actionId: currentStep.actionId,
          config: currentStep.config
        },
        user,
        workflow,
        workflowRun
      );

      try {
        // Execute the action
        const actionResult = await this.executeAction(
          user,
          currentStep,
          triggerData
        );

        // Log action completed
        await this.loggingService.createLog(
          LogEventType.ACTION_COMPLETED,
          {
            stepId: currentStepId,
            actionId: currentStep.actionId,
            result: actionResult
          },
          user,
          workflow,
          workflowRun
        );

        executionLog.push({
          stepId: currentStepId,
          type: 'action',
          appName: currentStep.appName,
          actionId: currentStep.actionId,
          result: actionResult,
          status: 'success'
        });

        currentStepId = currentStep.next; // Move to next step

      } catch (error: any) {
        // Log action failed
        await this.loggingService.createLog(
          LogEventType.ACTION_FAILED,
          {
            stepId: currentStepId,
            actionId: currentStep.actionId,
            error: error.message
          },
          user,
          workflow,
          workflowRun
        );

        executionLog.push({
          stepId: currentStepId,
          type: 'action',
          appName: currentStep.appName,
          actionId: currentStep.actionId,
          status: 'failed',
          error: error.message
        });

        throw error; // Stop workflow execution
      }
    }
  }

  return executionLog;
}
```

---

### 7.3 Condition Evaluation

**File**: `src/workflows/workflows.service.ts` → `evaluateCondition()` method

```typescript
private evaluateCondition(conditionStep: any, triggerData: any): string {
  const { field, operator, value } = conditionStep.condition;

  // Get field value from trigger data
  // Example: "trigger.from" → "boss@important.com"
  const actualValue = this.getNestedValue(triggerData, field);

  let result = false;

  switch (operator) {
    case 'equals':
      result = actualValue === value;
      break;
    case 'contains':
      result = String(actualValue).includes(value);
      break;
    case 'starts_with':
      result = String(actualValue).startsWith(value);
      break;
    case 'greater_than':
      result = Number(actualValue) > Number(value);
      break;
    case 'less_than':
      result = Number(actualValue) < Number(value);
      break;
  }

  console.log(
    `Condition: ${field} ${operator} "${value}" → ${result} (actual: "${actualValue}")`
  );

  // Return next step ID based on result
  return result ? conditionStep.onTrue : conditionStep.onFalse;
}
```

**Example Evaluation**:

```typescript
Condition: {
  field: "trigger.from",
  operator: "contains",
  value: "@important.com"
}

Trigger data: {
  trigger: {
    from: "boss@important.com",
    subject: "Urgent: Review needed"
  }
}

// Evaluation:
actualValue = "boss@important.com"
result = "boss@important.com".includes("@important.com") = true
return conditionStep.onTrue = "3" // Go to step 3 (Slack action)
```

---

### 7.4 Slack Action Execution

**File**: `src/workflows/workflows.service.ts` → `executeAction()` method

```typescript
private async executeAction(
  user: User,
  action: any,
  dataFromTrigger: any
): Promise<any> {
  const actionId = action.actionId || action.appName;

  switch (actionId) {
    case 'send_message': // Slack send message
      console.log('Sending real Slack message...');

      const channel = action.config?.channel;
      let text = action.config?.text || 'Automated message';

      if (!channel) {
        throw new Error('Slack channel is required');
      }

      // Replace template variables
      // Example: "New email from {{trigger.from}}: {{trigger.subject}}"
      if (dataFromTrigger) {
        text = text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          const value = this.getNestedValue(dataFromTrigger, key);
          return value !== undefined && value !== null ? value : match;
        });
      }

      // After replacement:
      // "New email from boss@important.com: Urgent: Review needed"

      // Call Slack API
      const result = await this.integrationsService.callSlackAPI(
        user,
        'sendMessage',
        { channel, text }
      );

      return {
        status: 'success',
        detail: `Message sent to Slack channel ${channel}`,
        channel,
        text,
        timestamp: result.ts
      };
  }
}
```

**Slack API Call** (`src/integrations/slack.integration.ts`):

```typescript
async sendMessage(accessToken: string, channel: string, text: string): Promise<any> {
  const response = await axios.post(
    'https://slack.com/api/chat.postMessage',
    {
      channel,
      text,
      mrkdwn: true
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.data.ok) {
    throw new Error(`Slack API error: ${response.data.error}`);
  }

  return response.data;
}
```

**Final Slack Message**:

```
Channel: #general
Message: "New email from boss@important.com: Urgent: Review needed"
```

---

## Logging & Monitoring

### Log Events Tracked

The system logs the following events:

| Event Type                     | When It Occurs                     |
| ------------------------------ | ---------------------------------- |
| `WORKFLOW_CREATED`             | Workflow is first created          |
| `WORKFLOW_ACTIVATED`           | Workflow is enabled for execution  |
| `WORKFLOW_DEACTIVATED`         | Workflow is disabled               |
| `TRIGGER_CHECKED`              | Scheduler checks trigger condition |
| `TRIGGER_FIRED`                | Trigger condition is met           |
| `WORKFLOW_EXECUTION_STARTED`   | Workflow starts executing          |
| `ACTION_STARTED`               | Individual action begins           |
| `ACTION_COMPLETED`             | Individual action succeeds         |
| `ACTION_FAILED`                | Individual action fails            |
| `WORKFLOW_EXECUTION_COMPLETED` | Workflow finishes successfully     |
| `WORKFLOW_EXECUTION_FAILED`    | Workflow fails                     |
| `TOKEN_REFRESHED`              | OAuth token is refreshed           |

### Log Structure

**Database**: `log` table with columns:

- `id`: Primary key
- `eventType`: Event type string
- `details`: JSON field with event-specific data
- `userId`: Foreign key to user
- `workflowId`: Foreign key to workflow
- `workflowRunId`: Foreign key to workflow run
- `createdAt`: Timestamp

**Example Log Entry**:

```json
{
  "id": 123,
  "eventType": "action_completed",
  "details": {
    "stepId": "3",
    "actionId": "send_message",
    "result": {
      "status": "success",
      "channel": "C12345",
      "text": "New email from boss@important.com: Urgent: Review needed",
      "timestamp": "1705316400.123456"
    }
  },
  "userId": 1,
  "workflowId": 1,
  "workflowRunId": 5,
  "createdAt": "2024-01-15T10:30:15.000Z"
}
```

---

## Error Handling & Retry Mechanism

### Retry Strategy

**BullMQ Configuration**:

```typescript
{
  attempts: 3,              // Retry up to 3 times total
  backoff: {
    type: 'exponential',
    delay: 1000             // Delays: 1s, 2s, 4s
  }
}
```

**Retry Timeline**:

- **Attempt 1** (immediate): Execute workflow
  - **Fails**: Wait 1 second
- **Attempt 2** (+1s): Re-execute workflow
  - **Fails**: Wait 2 seconds
- **Attempt 3** (+2s): Final re-execution
  - **Fails**: Mark as permanently failed

### Common Failure Scenarios

1. **OAuth Token Expired**:

   ```typescript
   // IntegrationsService automatically refreshes tokens
   if (userApp.expiresAt && new Date(userApp.expiresAt) < new Date()) {
     console.log('Access token expired, refreshing...');
     const newTokens = await this.oauthService.generateAccessToken(
       user,
       appName,
     );
     // Retry the API call with new token
   }
   ```

2. **API Rate Limit**:
   - BullMQ retries with exponential backoff
   - Logs `ACTION_FAILED` event
   - After 3 attempts, marks workflow run as failed

3. **Network Error**:
   - Retries with exponential backoff
   - If all retries fail, workflow run is marked as failed
   - Original trigger data is preserved in `workflow_run` table

---

## Code Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER AUTHENTICATION                           │
│  [POST /api/auth/register] → UsersService.create()              │
│  [POST /api/auth/login] → JwtService.generateToken()            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OAUTH APP CONNECTION                          │
│  [GET /api/oauth/gmail] → Redirect to Google                    │
│  [GET /api/oauth/callback/gmail] → Exchange code for tokens     │
│  OauthService.saveUserApp() → Store in user_app table           │
│  Repeat for Slack                                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW CREATION                             │
│  [POST /api/workflows] → WorkflowsService.create()              │
│  - Validate steps (trigger + actions)                           │
│  - Save to workflow table                                        │
│  - WorkflowsService.activateWorkflow()                          │
│  - Set isActive=true, pollingInterval=60                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKGROUND SCHEDULER (Every 30s)                    │
│  SchedulerService.pollWorkflows()                                │
│  ├─ Load all active workflows                                    │
│  └─ For each workflow:                                           │
│     ├─ calculateNextRunAt() → Check if time to run              │
│     └─ checkTrigger()                                            │
│        ├─ fetchNewEmails() → Call Gmail API                     │
│        ├─ filterUnprocessed() → Check processed_trigger         │
│        └─ If new email found:                                    │
│           ├─ Log TRIGGER_FIRED                                   │
│           ├─ QueueService.addWorkflowJob()                      │
│           └─ Update workflow.lastRunAt                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    QUEUE SYSTEM (BullMQ)                         │
│  Job added to Redis queue:                                       │
│  {                                                                │
│    workflowId: 1,                                                │
│    userId: 1,                                                    │
│    triggerData: { ... email data ... }                          │
│  }                                                                │
│  Config: 3 attempts, exponential backoff                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│            WORKER PROCESSOR (Picks up job)                       │
│  WorkflowProcessor.processWorkflow(job)                          │
│  ├─ Create WorkflowRun record (status: 'running')              │
│  ├─ Log WORKFLOW_EXECUTION_STARTED                              │
│  ├─ WorkflowsService.executeWorkflow()                          │
│  │  └─ executeWorkflowSteps()                                   │
│  │     ├─ Step 1: Trigger (already fired, use data)            │
│  │     ├─ Step 2: Condition                                     │
│  │     │  └─ evaluateCondition()                                │
│  │     │     - Check: trigger.from contains "@important.com"    │
│  │     │     - Result: true → Go to step 3                      │
│  │     └─ Step 3: Action (send_message)                         │
│  │        ├─ Log ACTION_STARTED                                 │
│  │        ├─ Replace template variables in text                 │
│  │        ├─ IntegrationsService.callSlackAPI()                 │
│  │        │  └─ SlackIntegration.sendMessage()                  │
│  │        │     └─ POST https://slack.com/api/chat.postMessage  │
│  │        └─ Log ACTION_COMPLETED                               │
│  ├─ Update WorkflowRun (status: 'success')                     │
│  ├─ Log WORKFLOW_EXECUTION_COMPLETED                            │
│  └─ Save to processed_trigger table (prevent duplicates)        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ✅ MESSAGE SENT TO SLACK!
```

---

## Summary of Complete Flow

1. **User registers/logs in** → Receives JWT token
2. **User connects Gmail & Slack** → OAuth tokens stored in `user_app` table
3. **User creates workflow** → Saved in `workflow` table with steps
4. **Workflow auto-activates** → Sets `isActive=true`, `pollingInterval=60`
5. **Scheduler polls every 30s** → Checks if it's time to run each workflow
6. **Scheduler checks Gmail** → Fetches unread emails from last 2 days
7. **New email found** → Checks if already processed in `processed_trigger`
8. **Trigger fires** → Adds job to BullMQ queue
9. **Worker picks up job** → Creates `WorkflowRun` record
10. **Worker executes steps**:
    - **Step 1**: Trigger (data already available)
    - **Step 2**: Condition (evaluates trigger.from contains "@important.com")
    - **Step 3**: Action (sends Slack message with replaced variables)
11. **Action completes** → Updates `WorkflowRun` to 'success'
12. **Records processed trigger** → Prevents duplicate execution
13. **Logs all events** → Stored in `log` table for monitoring

---

## Key Files Reference

| Component                | File Path                               |
| ------------------------ | --------------------------------------- |
| **Authentication**       | `src/auth/auth.service.ts`              |
| **User Management**      | `src/users/users.service.ts`            |
| **OAuth Flow**           | `src/oauth/oauth.service.ts`            |
| **Workflow CRUD**        | `src/workflows/workflows.service.ts`    |
| **Background Scheduler** | `src/queue/scheduler.service.ts`        |
| **Queue Service**        | `src/queue/queue.service.ts`            |
| **Worker Processor**     | `src/queue/workflow.processor.ts`       |
| **Gmail Integration**    | `src/integrations/gmail.integration.ts` |
| **Slack Integration**    | `src/integrations/slack.integration.ts` |
| **Logging Service**      | `src/db/logging.service.ts`             |
| **Main Entry Point**     | `src/main.ts`                           |

---

## Database Tables

| Table               | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `user`              | User accounts and credentials                |
| `user_app`          | OAuth tokens for connected apps              |
| `workflow`          | Workflow definitions with steps              |
| `workflow_run`      | Execution history for each workflow run      |
| `processed_trigger` | Tracks processed items to prevent duplicates |
| `log`               | Detailed event logs for monitoring           |

---

**End of Report**
