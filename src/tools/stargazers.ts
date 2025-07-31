import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { GitHubService } from "../github/index.js";
import type {
	LimitArgs,
	RepositoryArgs,
	TruncateResponseFunction,
} from "../types.js";

// Stargazer-related tool definitions
export const stargazerTools: Tool[] = [
	{
		name: "get_star_history",
		description:
			"Get comprehensive star history analytics inspired by star-history.com with growth trends and milestones",
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
	{
		name: "get_simple_star_history",
		description:
			"Get simplified star history metrics with star-history.com URL for visualization",
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
	{
		name: "get_complete_star_history",
		description:
			"Get complete star history analytics using ALL stargazers data (more accurate than limited sampling)",
		inputSchema: {
			type: "object",
			properties: {
				repository: {
					type: "string",
					description:
						"Repository identifier (owner/repo format or full GitHub URL)",
				},
			},
			required: ["repository"],
		},
	},
	{
		name: "get_stargazers",
		description:
			"Get stargazers for a repository with customizable limit (efficient for smaller datasets)",
		inputSchema: {
			type: "object",
			properties: {
				repository: {
					type: "string",
					description:
						"Repository identifier (owner/repo format or full GitHub URL)",
				},
				limit: {
					type: "number",
					description:
						"Maximum number of stargazers to return (default: 100, max: 10000)",
					default: 100,
				},
			},
			required: ["repository"],
		},
	},
	{
		name: "get_all_stargazers",
		description:
			"Get ALL stargazers for a repository (unlimited pagination through all 100-item pages)",
		inputSchema: {
			type: "object",
			properties: {
				repository: {
					type: "string",
					description:
						"Repository identifier (owner/repo format or full GitHub URL)",
				},
			},
			required: ["repository"],
		},
	},
	{
		name: "get_influencer_stargazers",
		description:
			"Analyze influential developers who have starred the repository based on follower count and activity. Adaptively analyzes ALL stargazers when rate limits allow, or uses smart sampling when limits are tight.",
		inputSchema: {
			type: "object",
			properties: {
				repository: {
					type: "string",
					description: "Repository identifier (owner/repo) or full GitHub URL",
				},
				limit: {
					type: "number",
					description:
						"Number of top influencers to return (default: 100, max: 200). Analysis scope adapts to GitHub API rate limits automatically.",
					default: 100,
				},
			},
			required: ["repository"],
		},
	},
];

// Stargazer tool handlers
export const createStargazerHandlers = (
	github: GitHubService,
	truncateResponse: TruncateResponseFunction,
) => ({
	get_star_history: async (args: RepositoryArgs) => {
		const result = await github.getStarHistory(args.repository);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	},

	get_simple_star_history: async (args: RepositoryArgs) => {
		const result = await github.getSimpleStarHistory(args.repository);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	},

	get_complete_star_history: async (args: RepositoryArgs) => {
		const result = await github.getCompleteStarHistory(args.repository);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	},

	get_stargazers: async (args: LimitArgs, maxChars?: number) => {
		const limit = Math.min(args.limit || 100, 10000); // Cap at 10K for safety
		const result = await github.getStargazers(args.repository, limit);

		// Condense stargazer data for token efficiency
		const condensedStargazers = result.map(
			(stargazer: { login: string; starred_at: string | null }) => ({
				login: stargazer.login,
				starred_at: stargazer.starred_at,
			}),
		);

		const responseData = {
			total_stargazers: condensedStargazers.length,
			requested_limit: limit,
			stargazers: condensedStargazers,
		};

		const { data: finalData } = truncateResponse(
			responseData,
			"stargazers",
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

	get_all_stargazers: async (args: RepositoryArgs, maxChars?: number) => {
		const result = await github.getAllStargazers(args.repository);

		// Condense stargazer data for token efficiency
		const condensedStargazers = result.map(
			(stargazer: { login: string; starred_at: string | null }) => ({
				login: stargazer.login,
				starred_at: stargazer.starred_at,
			}),
		);

		const responseData = {
			total_stargazers: condensedStargazers.length,
			note: "Complete dataset - all stargazers retrieved",
			stargazers: condensedStargazers,
		};

		const { data: finalData } = truncateResponse(
			responseData,
			"stargazers",
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

	get_influencer_stargazers: async (args: LimitArgs) => {
		// Get the number of top influencers to return (defaults to 100, max 200)
		const returnLimit = Math.min(args.limit || 100, 200);

		// This will now analyze ALL stargazers (rate limit permitting) and return top N
		const result = await github.getInfluencerAnalytics(
			args.repository,
			returnLimit,
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
