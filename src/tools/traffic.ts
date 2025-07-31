import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { GitHubService } from "../github/index.js";
import type { GitHubTrafficReferrer, TrafficArgs } from "../types.js";

// Type for categorized referrer with conversion rate
type CategorizedReferrer = GitHubTrafficReferrer & {
	category: string;
	conversion_rate: string;
};

// Traffic-related tool definitions
export const trafficTools: Tool[] = [
	{
		name: "get_traffic_referrers",
		description:
			"Get referral sources that drive traffic to the repository with comprehensive analytics",
		inputSchema: {
			type: "object",
			properties: {
				repository: {
					type: "string",
					description:
						"Repository identifier (owner/repo format or full GitHub URL)",
				},
				include_analysis: {
					type: "boolean",
					description:
						"Include detailed traffic analysis and insights (default: true)",
					default: true,
				},
			},
			required: ["repository"],
		},
	},
];

// Traffic tool handlers
export const createTrafficHandlers = (github: GitHubService) => ({
	get_traffic_referrers: async (args: TrafficArgs) => {
		const result = await github.getTrafficReferrers(args.repository);
		console.log("get_traffic_referrers", JSON.stringify(result));
		const includeAnalysis = args.include_analysis !== false; // Default to true

		// Calculate comprehensive analytics
		const totalTraffic = result.reduce(
			(sum: number, referrer) => sum + referrer.count,
			0,
		);
		const totalUniques = result.reduce(
			(sum: number, referrer) => sum + referrer.uniques,
			0,
		);

		// Categorize referrers by type
		const categorizeReferrer = (referrer: string) => {
			if (referrer === "Google") return "search_engine";
			if (referrer === "github.com") return "github_internal";
			if (referrer.includes("github.com")) return "github_related";
			if (
				referrer.includes("google.") ||
				referrer.includes("bing.") ||
				referrer.includes("duckduckgo.")
			)
				return "search_engine";
			if (referrer.includes("reddit.com")) return "social_media";
			if (
				referrer.includes("twitter.com") ||
				referrer.includes("x.com") ||
				referrer.includes("linkedin.com")
			)
				return "social_media";
			if (
				referrer.includes("stackoverflow.com") ||
				referrer.includes("stackexchange.com")
			)
				return "developer_community";
			if (referrer.includes("medium.com") || referrer.includes("dev.to"))
				return "blog_platform";
			if (referrer.includes("youtube.com") || referrer.includes("twitch.tv"))
				return "video_platform";
			return "other";
		};

		const categorizedReferrers: CategorizedReferrer[] = result.map(
			(referrer) => ({
				...referrer,
				category: categorizeReferrer(referrer.referrer),
				conversion_rate:
					referrer.count > 0
						? `${((referrer.uniques / referrer.count) * 100).toFixed(2)}%`
						: "0%",
			}),
		);

		// Category analysis
		const categoryStats = categorizedReferrers.reduce(
			(
				acc: Record<
					string,
					{ count: number; uniques: number; referrers: number }
				>,
				referrer,
			) => {
				const category = referrer.category;
				if (!acc[category]) {
					acc[category] = { count: 0, uniques: 0, referrers: 0 };
				}
				acc[category].count += referrer.count;
				acc[category].uniques += referrer.uniques;
				acc[category].referrers += 1;
				return acc;
			},
			{} as Record<
				string,
				{ count: number; uniques: number; referrers: number }
			>,
		);

		// Top performing metrics
		const topReferrerByTraffic = result.length > 0 ? result[0] : null;
		const topReferrerByUniques =
			result.length > 0
				? [...result].sort((a, b) => b.uniques - a.uniques)[0]
				: null;
		const bestConversionRate =
			categorizedReferrers.length > 0
				? categorizedReferrers.reduce((best, current) =>
						current.uniques / current.count > best.uniques / best.count
							? current
							: best,
					)
				: null;

		const analysisResult = {
			summary: {
				total_referrers: result.length,
				total_traffic: totalTraffic,
				total_unique_visitors: totalUniques,
				average_conversion_rate:
					totalTraffic > 0
						? `${((totalUniques / totalTraffic) * 100).toFixed(2)}%`
						: "0%",
				data_period: "Last 14 days (GitHub API limitation)",
				note:
					result.length === 0
						? "No traffic data available. This requires repository owner/admin access and recent traffic."
						: undefined,
			},
			top_performers: {
				highest_traffic: topReferrerByTraffic
					? {
							referrer: topReferrerByTraffic.referrer,
							total_visits: topReferrerByTraffic.count,
							category: categorizeReferrer(topReferrerByTraffic.referrer),
						}
					: null,
				highest_uniques: topReferrerByUniques
					? {
							referrer: topReferrerByUniques.referrer,
							unique_visitors: topReferrerByUniques.uniques,
							category: categorizeReferrer(topReferrerByUniques.referrer),
						}
					: null,
				best_conversion: bestConversionRate
					? {
							referrer: bestConversionRate.referrer,
							conversion_rate: bestConversionRate.conversion_rate,
							category: bestConversionRate.category,
						}
					: null,
			},
			...(includeAnalysis && {
				category_analysis: Object.entries(categoryStats)
					.map(
						([category, stats]: [
							string,
							{ count: number; uniques: number; referrers: number },
						]) => ({
							category,
							total_visits: stats.count,
							unique_visitors: stats.uniques,
							referrer_count: stats.referrers,
							traffic_share:
								totalTraffic > 0
									? `${((stats.count / totalTraffic) * 100).toFixed(2)}%`
									: "0%",
							avg_conversion_rate:
								stats.count > 0
									? `${((stats.uniques / stats.count) * 100).toFixed(2)}%`
									: "0%",
						}),
					)
					.sort((a, b) => b.total_visits - a.total_visits),
				traffic_insights: {
					is_organic_heavy:
						(categoryStats.search_engine?.count || 0) > totalTraffic * 0.5,
					has_social_presence: (categoryStats.social_media?.count || 0) > 0,
					developer_community_reach:
						(categoryStats.developer_community?.count || 0) > 0,
					github_visibility:
						(categoryStats.github_internal?.count || 0) > totalTraffic * 0.3,
				},
			}),
			detailed_referrers: categorizedReferrers.map((referrer, index) => ({
				rank: index + 1,
				referrer: referrer.referrer,
				category: referrer.category,
				total_visits: referrer.count,
				unique_visitors: referrer.uniques,
				conversion_rate: referrer.conversion_rate,
				traffic_percentage:
					totalTraffic > 0
						? `${((referrer.count / totalTraffic) * 100).toFixed(2)}%`
						: "0%",
				uniques_percentage:
					totalUniques > 0
						? `${((referrer.uniques / totalUniques) * 100).toFixed(2)}%`
						: "0%",
			})),
		};

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(analysisResult, null, 2),
				},
			],
		};
	},
});
