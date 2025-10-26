## Code Flow Diagram

┌─────────────────────────────────────────────────────────────────┐
│ USER AUTHENTICATION │
│ [POST /api/auth/register] → UsersService.create() │
│ [POST /api/auth/login] → JwtService.generateToken() │
└──────────────────────────────┬──────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ OAUTH APP CONNECTION │
│ [GET /api/oauth/gmail] → Redirect to Google │
│ [GET /api/oauth/callback/gmail] → Exchange code for tokens │
│ OauthService.saveUserApp() → Store in user_app table │
│ Repeat for Slack │
└──────────────────────────────┬──────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ WORKFLOW CREATION │
│ [POST /api/workflows] → WorkflowsService.create() │
│ - Validate steps (trigger + actions) │
│ - Save to workflow table │
│ - WorkflowsService.activateWorkflow() │
│ - Set isActive=true, pollingInterval=60 │
└──────────────────────────────┬──────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKGROUND SCHEDULER (Every 30s) │
│ SchedulerService.pollWorkflows() │
│ ├─ Load all active workflows │
│ └─ For each workflow: │
│ ├─ calculateNextRunAt() → Check if time to run │
│ └─ checkTrigger() │
│ ├─ fetchNewEmails() → Call Gmail API │
│ ├─ filterUnprocessed() → Check processed_trigger │
│ └─ If new email found: │
│ ├─ Log TRIGGER_FIRED │
│ ├─ QueueService.addWorkflowJob() │
│ └─ Update workflow.lastRunAt │
└──────────────────────────────┬──────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ QUEUE SYSTEM (BullMQ) │
│ Job added to Redis queue: │
│ { │
│ workflowId: 1, │
│ userId: 1, │
│ triggerData: { ... email data ... } │
│ } │
│ Config: 3 attempts, exponential backoff │
└──────────────────────────────┬──────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ WORKER PROCESSOR (Picks up job) │
│ WorkflowProcessor.processWorkflow(job) │
│ ├─ Create WorkflowRun record (status: 'running') │
│ ├─ Log WORKFLOW_EXECUTION_STARTED │
│ ├─ WorkflowsService.executeWorkflow() │
│ │ └─ executeWorkflowSteps() │
│ │ ├─ Step 1: Trigger (already fired, use data) │
│ │ ├─ Step 2: Condition │
│ │ │ └─ evaluateCondition() │
│ │ │ - Check: trigger.from contains "@important.com" │
│ │ │ - Result: true → Go to step 3 │
│ │ └─ Step 3: Action (send_message) │
│ │ ├─ Log ACTION_STARTED │
│ │ ├─ Replace template variables in text │
│ │ ├─ IntegrationsService.callSlackAPI() │
│ │ │ └─ SlackIntegration.sendMessage() │
│ │ │ └─ POST https://slack.com/api/chat.postMessage │
│ │ └─ Log ACTION_COMPLETED │
│ ├─ Update WorkflowRun (status: 'success') │
│ ├─ Log WORKFLOW_EXECUTION_COMPLETED │
│ └─ Save to processed_trigger table (prevent duplicates) │
└─────────────────────────────────────────────────────────────────┘
│
▼
MESSAGE SENT TO SLACK!
