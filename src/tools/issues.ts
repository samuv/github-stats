import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { GitHubService } from "../github/index.js";
import type {
	GitHubIssue,
	GitHubPullRequest,
	LimitArgs,
	TruncateResponseFunction,
} from "../types.js";

// Type guard for GitHub issue labels
function isLabelObject(label: unknown): label is { name: string } {
	return Boolean(
		label &&
			typeof label === "object" &&
			label !== null &&
			"name" in label &&
			typeof (label as Record<string, unknown>).name === "string",
	);
}

// Issues and Pull Requests related tool definitions
export const issuesTools: Tool[] = [
	{
		name: "get_open_issues",
		description: "Get list of open issues for a repository",
		inputSchema: {
			type: "object",
			properties: {
				repository: {
					type: "string",
					description: "Repository identifier (owner/repo) or full GitHub URL",
				},
				limit: {
					type: "number",
					description: "Maximum number of issues to return (default: 30)",
					default: 30,
				},
			},
			required: ["repository"],
		},
	},
	{
		name: "get_open_pull_requests",
		description: "Get list of open pull requests for a repository",
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
						"Maximum number of pull requests to return (default: 30)",
					default: 30,
				},
			},
			required: ["repository"],
		},
	},
];

// Issues tool handlers
export const createIssuesHandlers = (
	github: GitHubService,
	truncateResponse: TruncateResponseFunction,
) => ({
	get_open_issues: async (args: LimitArgs, maxChars?: number) => {
		const result = await github.getOpenIssues(
			args.repository,
			args.limit || 30,
		);

		// Include all issues but with only essential fields
		const condensedIssues = result.map((issue: GitHubIssue) => ({
			number: issue.number,
			title:
				issue.title.length > 100
					? `${issue.title.substring(0, 100)}...`
					: issue.title,
			user: issue.user?.login,
			state: issue.state,
			created_at: issue.created_at,
			labels:
				issue.labels?.slice(0, 2).map((label) => {
					if (typeof label === "string") return label;
					if (isLabelObject(label)) return label.name;
					return String(label);
				}) || [],
		}));

		const responseData = {
			total_open_issues: condensedIssues.length,
			issues: condensedIssues,
		};

		const { data: finalData } = truncateResponse(
			responseData,
			"issues",
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

	get_open_pull_requests: async (args: LimitArgs, maxChars?: number) => {
		const result = await github.getOpenPullRequests(
			args.repository,
			args.limit || 30,
		);

		// Include all pull requests but with only essential fields
		const condensedPRs = result.map((pr: GitHubPullRequest) => ({
			number: pr.number,
			title:
				pr.title.length > 80 ? `${pr.title.substring(0, 80)}...` : pr.title,
			user: pr.user?.login,
			state: pr.state,
			created_at: pr.created_at,
			head_ref: pr.head?.ref,
			base_ref: pr.base?.ref,
		}));

		const responseData = {
			total_open_prs: condensedPRs.length,
			pull_requests: condensedPRs,
		};

		const { data: finalData } = truncateResponse(
			responseData,
			"pull_requests",
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
