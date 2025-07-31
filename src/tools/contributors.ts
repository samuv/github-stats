import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { GitHubService } from "../github/index.js";
import type {
	GitHubContributor,
	LimitArgs,
	TruncateResponseFunction,
} from "../types.js";

// Contributors-related tool definitions
export const contributorsTools: Tool[] = [
	{
		name: "get_contributors",
		description: "Get list of contributors to a repository",
		inputSchema: {
			type: "object",
			properties: {
				repository: {
					type: "string",
					description: "Repository identifier (owner/repo) or full GitHub URL",
				},
				limit: {
					type: "number",
					description: "Maximum number of contributors to return (default: 30)",
					default: 30,
				},
			},
			required: ["repository"],
		},
	},
];

// Contributors tool handlers
export const createContributorsHandlers = (
	github: GitHubService,
	truncateResponse: TruncateResponseFunction,
) => ({
	get_contributors: async (args: LimitArgs, maxChars?: number) => {
		const result = await github.getContributors(
			args.repository,
			args.limit || 30,
		);

		// Include all contributors but with only essential fields
		const condensedContributors = result.map(
			(contributor: GitHubContributor) => ({
				login: contributor.login,
				contributions: contributor.contributions,
				type: contributor.type,
			}),
		);

		const responseData = {
			total_contributors: condensedContributors.length,
			contributors: condensedContributors,
		};

		const { data: finalData } = truncateResponse(
			responseData,
			"contributors",
			maxChars,
		);

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(finalData, null, 2),
				},
			],
		};
	},
});
