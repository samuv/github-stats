/**
 * GitHub API client setup and configuration
 */
import { Octokit } from '@octokit/rest';

export interface GitHubConfig {
  token?: string;
  userAgent?: string;
}

export const createClient = (config: GitHubConfig = {}): Octokit => {
  return new Octokit({
    auth: config.token,
    userAgent: config.userAgent || 'github-stats-mcp/1.0.0'
  });
};

export const defaultClient: Octokit = createClient({
  token: process.env.GITHUB_TOKEN
});