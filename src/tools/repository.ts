import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { GitHubService } from "../github/index.js";
import type { RepositoryArgs, TruncateResponseFunction } from "../types.js";

// Repository-related tool definitions
export const repositoryTools: Tool[] = [
	{
		name: "get_repository_info",
		description:
			"Get basic information about a GitHub repository including stars, forks, description, etc.",
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
		name: "get_language_stats",
		description: "Get programming language statistics for a repository",
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
		name: "get_comprehensive_stats",
		description:
			"Get comprehensive statistics for a repository including all available data",
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

// Repository tool handlers
export const createRepositoryHandlers = (
	github: GitHubService,
	_truncateResponse: TruncateResponseFunction,
) => ({
	get_repository_info: async (args: RepositoryArgs) => {
		const result = await github.getRepository(args.repository);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	},

	get_language_stats: async (args: RepositoryArgs) => {
		const result = await github.getLanguageBreakdown(args.repository);

		// Calculate total bytes
		const totalBytes = result.reduce(
			(sum: number, lang: { bytes: number }) => sum + lang.bytes,
			0,
		);

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							total_bytes: totalBytes,
							languages: result,
						},
						null,
						2,
					),
				},
			],
		};
	},

	get_comprehensive_stats: async (args: RepositoryArgs, _maxChars?: number) => {
		const result = await github.getComprehensiveStats(args.repository);

		// Add some calculated summaries
		const languageTotal = Object.values(result.languages).reduce(
			(sum: number, bytes: number) => sum + bytes,
			0,
		);
		const languageBreakdown = Object.entries(result.languages)
			.map(([language, bytes]: [string, number]) => ({
				language,
				percentage: ((bytes / languageTotal) * 100).toFixed(2),
			}))
			.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

		// Safely handle commitActivity which might be null/undefined
		const commitActivityArray = Array.isArray(result.commitActivity)
			? result.commitActivity
			: [];
		const totalCommits = commitActivityArray.reduce(
			(sum: number, week: { total?: number }) => sum + (week?.total || 0),
			0,
		);

		// Condense the response to stay within token limits - remove full arrays
		const condensedResult = {
			repository: {
				name: result.repository.name,
				full_name: result.repository.full_name,
				description: result.repository.description,
				stars: result.repository.stargazers_count,
				forks: result.repository.forks_count,
				watchers: result.repository.watchers_count,
				open_issues: result.repository.open_issues_count,
				size: result.repository.size,
				created_at: result.repository.created_at,
				updated_at: result.repository.updated_at,
				pushed_at: result.repository.pushed_at,
				language: result.repository.language,
				license: result.repository.license,
				topics: result.repository.topics,
				archived: result.repository.archived,
				private: result.repository.private,
			},

			contributors_summary: {
				total_contributors: result.contributors.length,
				top_5_contributors: result.contributors.slice(0, 5).map((c) => ({
					login: c.login,
					contributions: c.contributions,
					type: c.type,
				})),
			},

			releases_summary: {
				total_releases: result.releases.length,
				latest_3_releases: result.releases.slice(0, 3).map((r) => ({
					tag_name: r.tag_name,
					name: r.name,
					published_at: r.published_at,
					prerelease: r.prerelease,
				})),
			},

			issues_summary: {
				total_open_issues: result.openIssues.length,
				recent_3_issues: result.openIssues.slice(0, 3).map((i) => ({
					number: i.number,
					title:
						i.title.substring(0, 100) + (i.title.length > 100 ? "..." : ""),
					created_at: i.created_at,
				})),
			},

			pull_requests_summary: {
				total_open_prs: result.openPullRequests.length,
				recent_3_prs: result.openPullRequests.slice(0, 3).map((pr) => ({
					number: pr.number,
					title:
						pr.title.substring(0, 100) + (pr.title.length > 100 ? "..." : ""),
					created_at: pr.created_at,
					user: pr.user?.login,
				})),
			},

			release_analytics_summary: {
				total_releases: result.releaseAnalytics.total_releases,
				total_downloads: result.releaseAnalytics.total_downloads,
				average_downloads_per_release:
					result.releaseAnalytics.average_downloads_per_release,
				most_downloaded_release:
					result.releaseAnalytics.most_downloaded_release,
				latest_release: result.releaseAnalytics.latest_release,
			},

			star_history_summary: {
				current_stars: result.starHistory.current_stars,
				total_growth: result.starHistory.total_growth,
				daily_growth_rate: result.starHistory.growth_rate_per_day,
				monthly_growth_rate: result.starHistory.growth_rate_per_month,
				recent_growth_30_days: result.starHistory.growth_trends.last_30_days,
				milestones_count: result.starHistory.milestones.length,
			},

			summary: {
				total_stars: result.repository.stargazers_count,
				total_forks: result.repository.forks_count,
				total_watchers: result.repository.watchers_count,
				total_open_issues: result.repository.open_issues_count,
				total_contributors: result.contributors.length,
				total_releases: result.releaseAnalytics.total_releases,
				total_downloads: result.releaseAnalytics.total_downloads,
				total_commits_last_year: totalCommits,
				primary_language: result.repository.language,
				language_breakdown: languageBreakdown.slice(0, 5),
				repository_age_days: Math.floor(
					(Date.now() - new Date(result.repository.created_at).getTime()) /
						(1000 * 60 * 60 * 24),
				),
				last_updated: result.repository.updated_at,
			},

			metadata: {
				note: "Condensed comprehensive stats. Use individual tools for detailed data.",
				condensed_at: new Date().toISOString(),
			},
		};

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(condensedResult, null, 2),
				},
			],
		};
	},
});
