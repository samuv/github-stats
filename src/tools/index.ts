import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { GitHubService } from "../github/index.js";
import type { HandlerResponseData } from "../types.js";
import { activityTools, createActivityHandlers } from "./activity.js";
import {
	contributorsTools,
	createContributorsHandlers,
} from "./contributors.js";
import { createIssuesHandlers, issuesTools } from "./issues.js";
import { createReleasesHandlers, releasesTools } from "./releases.js";
// Import all tool definitions
import { createRepositoryHandlers, repositoryTools } from "./repository.js";
import { createSearchHandlers, searchTools } from "./search.js";
import { createStargazerHandlers, stargazerTools } from "./stargazers.js";
import { createTrafficHandlers, trafficTools } from "./traffic.js";

// Export all tools combined
export const tools: Tool[] = [
	...repositoryTools,
	...contributorsTools,
	...releasesTools,
	...activityTools,
	...issuesTools,
	...searchTools,
	...stargazerTools,
	...trafficTools,
];

// Create all tool handlers
export const createToolHandlers = (
	github: GitHubService,
	truncateResponse: (
		data: HandlerResponseData,
		arrayFieldName: string,
		maxChars?: number,
	) => { data: HandlerResponseData; wasTruncated: boolean },
) => {
	const repositoryHandlers = createRepositoryHandlers(github, truncateResponse);
	const releasesHandlers = createReleasesHandlers(github, truncateResponse);
	const stargazerHandlers = createStargazerHandlers(github, truncateResponse);
	const issuesHandlers = createIssuesHandlers(github, truncateResponse);
	const contributorsHandlers = createContributorsHandlers(
		github,
		truncateResponse,
	);
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
		...trafficHandlers,
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
	createTrafficHandlers,
};
