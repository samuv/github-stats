/**
 * Repository operations and basic data fetching
 */
import type { Octokit } from '@octokit/rest';
import type {
  GitHubRepository,
  GitHubLanguageStats,
  GitHubContributor,
  GitHubCommitActivity,
  GitHubCommitActivityResponse,
  GitHubPullRequest,
  GitHubIssue,
  GitHubTrafficReferrer,
  GitHubSearchRepository
} from '../types.js';
import { parseRepoIdentifier, withErrorHandling, sum, average, calculateDaysBetween } from '../utils/helpers.js';

// Basic repository operations
export const getRepository = (client: Octokit) => 
  withErrorHandling(async (identifier: string): Promise<GitHubRepository> => {
    const { owner, repo } = parseRepoIdentifier(identifier);
    const response = await client.rest.repos.get({ owner, repo });
    return response.data;
  }, 'Failed to fetch repository');

export const getLanguages = (client: Octokit) => 
  withErrorHandling(async (identifier: string): Promise<GitHubLanguageStats> => {
    const { owner, repo } = parseRepoIdentifier(identifier);
    const response = await client.rest.repos.listLanguages({ owner, repo });
    return response.data;
  }, 'Failed to fetch languages');

export const getContributors = (client: Octokit) => 
  withErrorHandling(async (identifier: string, limit = 30): Promise<GitHubContributor[]> => {
    const { owner, repo } = parseRepoIdentifier(identifier);
    const response = await client.rest.repos.listContributors({
      owner,
      repo,
      per_page: limit
    });
    return response.data as GitHubContributor[];
  }, 'Failed to fetch contributors');

export const getCommitActivity = (client: Octokit) => 
  withErrorHandling(async (identifier: string): Promise<GitHubCommitActivity[]> => {
    const { owner, repo } = parseRepoIdentifier(identifier);
    const response = await client.rest.repos.getCommitActivityStats({ owner, repo });
    
    // GitHub API can return null, undefined, or an array
    const data = response.data as GitHubCommitActivityResponse;
    if (!data || !Array.isArray(data)) {
      return [];
    }
    
    return data as GitHubCommitActivity[];
  }, 'Failed to fetch commit activity');

export const getOpenIssues = (client: Octokit) => 
  withErrorHandling(async (identifier: string, limit = 30): Promise<GitHubIssue[]> => {
    const { owner, repo } = parseRepoIdentifier(identifier);
    const response = await client.rest.issues.listForRepo({
      owner,
      repo,
      state: 'open',
      per_page: limit
    });
    return response.data.filter(issue => !issue.pull_request);
  }, 'Failed to fetch issues');

export const getOpenPullRequests = (client: Octokit) => 
  withErrorHandling(async (identifier: string, limit = 30): Promise<GitHubPullRequest[]> => {
    const { owner, repo } = parseRepoIdentifier(identifier);
    const response = await client.rest.pulls.list({
      owner,
      repo,
      state: 'open',
      per_page: limit
    });
    return response.data;
  }, 'Failed to fetch pull requests');

export const searchRepositories = (client: Octokit) => 
  withErrorHandling(async (query: string, limit = 10): Promise<GitHubSearchRepository[]> => {
    const response = await client.rest.search.repos({
      q: query,
      per_page: limit,
      sort: 'stars',
      order: 'desc'
    });
    return response.data.items;
  }, 'Failed to search repositories');

export const getTrafficReferrers = (client: Octokit) => 
  withErrorHandling(async (identifier: string): Promise<GitHubTrafficReferrer[]> => {
    const { owner, repo } = parseRepoIdentifier(identifier);
    
    try {
      const response = await client.rest.repos.getTopReferrers({
        owner,
        repo
      });
      return response.data as GitHubTrafficReferrer[];
    } catch (error: any) {
      // Handle 403 (insufficient permissions) or 404 (repo not found) gracefully
      if (error.status === 403) {
        console.warn(`Insufficient permissions to access traffic data for ${identifier}. Repository owner/admin access required.`);
        return [];
      }
      if (error.status === 404) {
        console.warn(`Repository ${identifier} not found or not accessible`);
        return [];
      }
      throw error;
    }
  }, 'Failed to fetch traffic referrers');

// Data transformations
export const calculateLanguageBreakdown = (languages: GitHubLanguageStats) => {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
  
  return Object.entries(languages)
    .map(([language, bytes]) => ({
      language,
      bytes,
      percentage: ((bytes / total) * 100).toFixed(2)
    }))
    .sort((a, b) => b.bytes - a.bytes);
};

export const analyzeCommitActivity = (activity: GitHubCommitActivity[]) => {
  // Handle empty or null activity arrays
  if (!Array.isArray(activity) || activity.length === 0) {
    return {
      summary: {
        total_commits: 0,
        average_commits_per_week: 0,
        most_active_week: null
      },
      weekly_activity: []
    };
  }

  const totalCommits = sum(activity.map(week => week?.total || 0));
  const avgCommitsPerWeek = average(activity.map(week => week?.total || 0));
  const mostActiveWeek = activity.reduce(
    (max, week) => (week?.total || 0) > max.total ? week : max, 
    { total: 0, week: 0, days: [] }
  );

  return {
    summary: {
      total_commits: totalCommits,
      average_commits_per_week: Math.round(avgCommitsPerWeek * 100) / 100,
      most_active_week: mostActiveWeek.total > 0 ? {
        week_timestamp: mostActiveWeek.week,
        commits: mostActiveWeek.total,
        date: new Date(mostActiveWeek.week * 1000).toISOString().split('T')[0]
      } : null
    },
    weekly_activity: activity
  };
};