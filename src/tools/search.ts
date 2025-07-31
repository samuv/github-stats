import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { GitHubService } from "../github/index.js";
import type { SearchArgs } from "../types.js";

// Search-related tool definitions
export const searchTools: Tool[] = [
	{
		name: "search_repositories",
		description: "Search for repositories on GitHub",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description:
						'Search query (e.g., "machine learning python", "user:microsoft", "topic:react")',
				},
				limit: {
					type: "number",
					description: "Maximum number of repositories to return (default: 10)",
					default: 10,
				},
			},
			required: ["query"],
		},
	},
];

// Search tool handlers
export const createSearchHandlers = (github: GitHubService) => ({
	search_repositories: async (args: SearchArgs) => {
		const result = await github.searchRepositories(
			args.query,
			args.limit || 10,
		);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	},
});
