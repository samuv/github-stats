import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { GitHubService } from "../github/index.js";
import type { RepositoryArgs } from "../types.js";

// Activity-related tool definitions
export const activityTools: Tool[] = [
	{
		name: "get_commit_activity",
		description:
			"Get commit activity statistics for a repository (weekly activity for the past year)",
		inputSchema: {
			type: "object",
			properties: {
				repository: {
					type: "string",
					description: "Repository identifier (owner/repo) or full GitHub URL",
				},
			},
			required: ["repository"],
		},
	},
];

// Activity tool handlers
export const createActivityHandlers = (github: GitHubService) => ({
	get_commit_activity: async (args: RepositoryArgs) => {
		const result = await github.getCommitActivitySummary(args.repository);
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
