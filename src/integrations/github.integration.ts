import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  description: string;
  html_url: string;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  email: string;
  bio: string;
  public_repos: number;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
  commit: {
    sha: string;
    url: string;
  };
}

@Injectable()
export class GitHubIntegration {
  private readonly baseUrl = 'https://api.github.com';

  async listRepos(accessToken: string): Promise<GitHubRepo[]> {
    try {
      const url = `${this.baseUrl}/user/repos`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
        params: {
          sort: 'updated',
          per_page: 100,
        },
      });

      return response.data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        description: repo.description || '',
        html_url: repo.html_url,
      }));
    } catch (error: any) {
      console.error(
        'Error listing GitHub repos:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to list GitHub repos: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getCurrentUser(accessToken: string): Promise<GitHubUser> {
    try {
      const url = `${this.baseUrl}/user`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      });

      return {
        login: response.data.login,
        id: response.data.id,
        avatar_url: response.data.avatar_url,
        name: response.data.name,
        email: response.data.email,
        bio: response.data.bio || '',
        public_repos: response.data.public_repos,
      };
    } catch (error: any) {
      console.error(
        'Error getting GitHub user:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to get GitHub user: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async listBranches(
    accessToken: string,
    owner: string,
    repo: string,
  ): Promise<GitHubBranch[]> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/branches`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
        params: {
          per_page: 100,
        },
      });

      return response.data.map((branch: any) => ({
        name: branch.name,
        protected: branch.protected,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url,
        },
      }));
    } catch (error: any) {
      console.error(
        'Error listing GitHub branches:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to list branches: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async createIssue(
    accessToken: string,
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[],
    assignees?: string[],
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/issues`;
      const response = await axios.post(
        url,
        {
          title,
          body,
          labels: labels || [],
          assignees: assignees || [],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      return {
        number: response.data.number,
        html_url: response.data.html_url,
        state: response.data.state,
      };
    } catch (error: any) {
      console.error(
        'Error creating GitHub issue:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to create issue: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async listIssues(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    per_page: number = 10,
  ): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/issues`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
        params: {
          state,
          per_page,
          sort: 'created',
          direction: 'desc',
        },
      });

      return response.data.map((issue: any) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state,
        author: issue.user.login,
        html_url: issue.html_url,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        labels: issue.labels.map((label: any) => label.name),
      }));
    } catch (error: any) {
      console.error(
        'Error listing GitHub issues:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to list issues: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async listPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    per_page: number = 10,
  ): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
        params: {
          state,
          per_page,
          sort: 'created',
          direction: 'desc',
        },
      });

      return response.data.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: pr.state,
        author: pr.user.login,
        html_url: pr.html_url,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        base_branch: pr.base.ref,
        head_branch: pr.head.ref,
      }));
    } catch (error: any) {
      console.error(
        'Error listing GitHub PRs:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to list pull requests: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async listCommits(
    accessToken: string,
    owner: string,
    repo: string,
    branch?: string,
    per_page: number = 10,
  ): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/commits`;
      const params: any = {
        per_page,
      };
      if (branch) {
        params.sha = branch;
      }

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
        params,
      });

      return response.data.map((commit: any) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        author_email: commit.commit.author.email,
        date: commit.commit.author.date,
        html_url: commit.html_url,
      }));
    } catch (error: any) {
      console.error(
        'Error listing GitHub commits:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to list commits: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async listIssueComments(
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber?: number,
    per_page: number = 10,
  ): Promise<any[]> {
    try {
      let url: string;
      if (issueNumber) {
        url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
      } else {
        url = `${this.baseUrl}/repos/${owner}/${repo}/issues/comments`;
      }

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
        params: {
          per_page,
          sort: 'created',
          direction: 'desc',
        },
      });

      return response.data.map((comment: any) => ({
        id: comment.id,
        body: comment.body,
        author: comment.user.login,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        html_url: comment.html_url,
      }));
    } catch (error: any) {
      console.error(
        'Error listing GitHub issue comments:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to list issue comments: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async addCommentToIssue(
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    comment: string,
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
      const response = await axios.post(
        url,
        { body: comment },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      return {
        id: response.data.id,
        html_url: response.data.html_url,
        body: response.data.body,
      };
    } catch (error: any) {
      console.error(
        'Error adding comment to GitHub issue:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to add comment: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async closeIssue(
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`;
      const response = await axios.patch(
        url,
        { state: 'closed' },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      return {
        number: response.data.number,
        state: response.data.state,
        html_url: response.data.html_url,
      };
    } catch (error: any) {
      console.error(
        'Error closing GitHub issue:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to close issue: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async assignIssue(
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    assignees: string[],
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`;
      const response = await axios.patch(
        url,
        { assignees },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      return {
        number: response.data.number,
        assignees: response.data.assignees.map((a: any) => a.login),
        html_url: response.data.html_url,
      };
    } catch (error: any) {
      console.error(
        'Error assigning GitHub issue:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to assign issue: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}
