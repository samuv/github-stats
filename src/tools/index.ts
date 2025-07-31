import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { HandlerResponseData } from '../types.js';

// Import all tool definitions
import { repositoryTools, createRepositoryHandlers } from './repository.js';
import { releasesTools, createReleasesHandlers } from './releases.js';
import { stargazerTools, createStargazerHandlers } from './stargazers.js';
import { issuesTools, createIssuesHandlers } from './issues.js';
import { contributorsTools, createContributorsHandlers } from './contributors.js';
import { activityTools, createActivityHandlers } from './activity.js';
import { searchTools, createSearchHandlers } from './search.js';
import { trafficTools, createTrafficHandlers } from './traffic.js';
import { GitHubService } from '../github/index.js';

// Export all tools combined
export const tools: Tool[] = [
  ...repositoryTools,
  ...contributorsTools,
  ...releasesTools,
  ...activityTools,
  ...issuesTools,
  ...searchTools,
  ...stargazerTools,
  ...trafficTools
];

// Create all tool handlers
export const createToolHandlers = (github: GitHubService, truncateResponse: (data: HandlerResponseData, arrayFieldName: string, maxChars?: number) => { data: HandlerResponseData; wasTruncated: boolean }) => {
  const repositoryHandlers = createRepositoryHandlers(github, truncateResponse);
  const releasesHandlers = createReleasesHandlers(github, truncateResponse);
  const stargazerHandlers = createStargazerHandlers(github, truncateResponse);
  const issuesHandlers = createIssuesHandlers(github, truncateResponse);
  const contributorsHandlers = createContributorsHandlers(github, truncateResponse);
  const activityHandlers = createActivityHandlers(github);
  const searchHandlers = createSearchHandlers(github);
  const trafficHandlers = createTrafficHandlers(github);

  return {
    ...repositoryHandlers,
    ...releasesHandlers,
    ...stargazerHandlers,
    ...issuesHandlers,
    ...contributorsHandlers,
    ...activityHandlers,
    ...searchHandlers,
    ...trafficHandlers
  };
};

// Export individual handler creators for flexibility
export {
  createRepositoryHandlers,
  createReleasesHandlers,
  createStargazerHandlers,
  createIssuesHandlers,
  createContributorsHandlers,
  createActivityHandlers,
  createSearchHandlers,
  createTrafficHandlers
};