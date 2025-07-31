/**
 * Star history and influencer analytics operations
 */
import type { Octokit } from "@octokit/rest";
import type {
	GitHubRepository,
	InfluencerAnalytics,
	InfluencerDeveloper,
	StarHistoryAnalytics,
	StarHistoryPoint,
} from "../types.js";
import {
	calculateAgeInDays,
	groupBy,
	median,
	parseRepoIdentifier,
	processInBatches,
	sortByField,
	sum,
	withErrorHandling,
} from "../utils/helpers.js";

// Type guards for stargazer API responses
function isStargazerWithUser(
	item: unknown,
): item is { user: { login: string } | null; starred_at: string } {
	return Boolean(
		item && typeof item === "object" && item !== null && "user" in item,
	);
}

function isRegularUser(item: unknown): item is { login: string; id: number } {
	return Boolean(
		item &&
			typeof item === "object" &&
			item !== null &&
			"login" in item &&
			typeof (item as Record<string, unknown>).login === "string",
	);
}

// Stargazer fetching operations - ALL stargazers (unlimited)
export const getAllStargazersWithTimestamps = (client: Octokit) =>
	withErrorHandling(
		async (
			identifier: string,
		): Promise<Array<{ login: string; starred_at: string | null }>> => {
			const { owner, repo } = parseRepoIdentifier(identifier);
			const stargazers: Array<{ login: string; starred_at: string | null }> =
				[];
			let page = 1;
			const perPage = 100; // Maximum allowed by GitHub API

			console.error(`Fetching ALL stargazers for ${identifier}...`);

			while (true) {
				try {
					const response = await client.rest.activity.listStargazersForRepo({
						owner,
						repo,
						per_page: perPage,
						page,
						headers: {
							Accept: "application/vnd.github.star+json",
						},
					});

					if (response.data.length === 0) {
						console.error(
							`Finished fetching stargazers. Total: ${stargazers.length}`,
						);
						break;
					}

					const batchStargazers = response.data
						.map((item) => {
							if (isStargazerWithUser(item)) {
								return {
									login: item.user?.login || "",
									starred_at: item.starred_at || null,
								};
							}
							// Fallback for regular user API response
							if (isRegularUser(item)) {
								return {
									login: item.login,
									starred_at: null,
								};
							}
							return null;
						})
						.filter(
							(s): s is NonNullable<typeof s> => s !== null && s.login !== "",
						);

					stargazers.push(...batchStargazers);
					console.error(
						`Fetched page ${page}: ${batchStargazers.length} stargazers (total: ${stargazers.length})`,
					);

					// If we got less than perPage results, we've reached the end
					if (response.data.length < perPage) {
						console.error(
							`Finished fetching stargazers. Total: ${stargazers.length}`,
						);
						break;
					}

					page++;

					// Rate limiting: Add a small delay between requests to be respectful
					if (page % 10 === 0) {
						console.error(
							`Rate limiting: Pausing for 1 second after ${page} pages...`,
						);
						await new Promise((resolve) => setTimeout(resolve, 1000));
					}
				} catch (error: unknown) {
					const message =
						error instanceof Error ? error.message : String(error);
					console.error("Star timestamp API error, using fallback:", message);
					return getAllStargazersFallback(client)(identifier);
				}
			}

			return stargazers;
		},
		"Failed to fetch all stargazers",
	);

// Limited stargazer fetching (for backward compatibility)
export const getStargazersWithTimestamps = (client: Octokit) =>
	withErrorHandling(
		async (
			identifier: string,
			limit = 1000,
		): Promise<Array<{ login: string; starred_at: string | null }>> => {
			const { owner, repo } = parseRepoIdentifier(identifier);
			const stargazers: Array<{ login: string; starred_at: string | null }> =
				[];
			let page = 1;
			const perPage = Math.min(100, limit as number);

			while (stargazers.length < (limit as number)) {
				try {
					const response = await client.rest.activity.listStargazersForRepo({
						owner,
						repo,
						per_page: perPage,
						page,
						headers: {
							Accept: "application/vnd.github.star+json",
						},
					});

					if (response.data.length === 0) break;

					const batchStargazers = response.data
						.map((item) => {
							if (isStargazerWithUser(item)) {
								return {
									login: item.user?.login || "",
									starred_at: item.starred_at || null,
								};
							}
							// Fallback for regular user API response
							if (isRegularUser(item)) {
								return {
									login: item.login,
									starred_at: null,
								};
							}
							return null;
						})
						.filter(
							(s): s is NonNullable<typeof s> => s !== null && s.login !== "",
						);

					stargazers.push(...batchStargazers);

					if (
						response.data.length < perPage ||
						stargazers.length >= (limit as number)
					)
						break;
					page++;
				} catch (_error: unknown) {
					// Fallback to regular API if timestamps aren't available
					console.error("Star timestamp API not available, using fallback");
					return getStargazersFallback(client)(identifier, limit as number);
				}
			}

			return stargazers.slice(0, limit as number);
		},
		"Failed to fetch stargazers",
	);

// Fallback for ALL stargazers (unlimited) when timestamps aren't available
const getAllStargazersFallback =
	(client: Octokit) =>
	async (
		identifier: string,
	): Promise<Array<{ login: string; starred_at: string | null }>> => {
		const { owner, repo } = parseRepoIdentifier(identifier);
		const stargazers: Array<{ login: string; starred_at: string | null }> = [];
		let page = 1;
		const perPage = 100; // Maximum allowed by GitHub API

		console.error(`Using fallback API for ALL stargazers for ${identifier}...`);

		while (true) {
			const response = await client.rest.activity.listStargazersForRepo({
				owner,
				repo,
				per_page: perPage,
				page,
			});

			if (response.data.length === 0) {
				console.error(
					`Fallback finished. Total stargazers: ${stargazers.length}`,
				);
				break;
			}

			const batchStargazers = response.data
				.filter(isRegularUser)
				.map((user) => ({
					login: (user as { login: string }).login,
					starred_at: null,
				}));

			stargazers.push(...batchStargazers);
			console.error(
				`Fallback page ${page}: ${batchStargazers.length} stargazers (total: ${stargazers.length})`,
			);

			if (response.data.length < perPage) {
				console.error(
					`Fallback finished. Total stargazers: ${stargazers.length}`,
				);
				break;
			}

			page++;

			// Rate limiting for fallback as well
			if (page % 10 === 0) {
				console.error(
					`Fallback rate limiting: Pausing for 1 second after ${page} pages...`,
				);
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		return stargazers;
	};

// Limited fallback (for backward compatibility)
const getStargazersFallback =
	(client: Octokit) =>
	async (
		identifier: string,
		limit: number,
	): Promise<Array<{ login: string; starred_at: string | null }>> => {
		const { owner, repo } = parseRepoIdentifier(identifier);
		const stargazers: Array<{ login: string; starred_at: string | null }> = [];
		let page = 1;
		const perPage = Math.min(100, limit as number);

		while (stargazers.length < (limit as number)) {
			const response = await client.rest.activity.listStargazersForRepo({
				owner,
				repo,
				per_page: perPage,
				page,
			});

			if (response.data.length === 0) break;

			const batchStargazers = response.data
				.filter(isRegularUser)
				.map((user) => ({
					login: (user as { login: string }).login,
					starred_at: null,
				}));

			stargazers.push(...batchStargazers);

			if (
				response.data.length < perPage ||
				stargazers.length >= (limit as number)
			)
				break;
			page++;
		}

		return stargazers.slice(0, limit as number);
	};

// Star history analytics
export const calculateStarHistory = (
	repository: GitHubRepository,
	stargazers: Array<{ starred_at: string | null }>,
): StarHistoryAnalytics => {
	const currentStars = repository.stargazers_count;
	const ageInDays = calculateAgeInDays(repository.created_at);

	const starsByDate = groupBy(
		stargazers.filter((s) => s.starred_at),
		(stargazer) => stargazer.starred_at?.split("T")[0] || "unknown",
	);

	const historyPoints: StarHistoryPoint[] = [];
	let runningStars = 0;

	const sortedDates = Object.keys(starsByDate).sort();
	for (const date of sortedDates) {
		const dailyStars = starsByDate[date].length;
		runningStars += dailyStars;

		historyPoints.push({
			date,
			stars: runningStars,
			change: dailyStars,
		});
	}

	const growthRatePerDay = ageInDays > 0 ? currentStars / ageInDays : 0;
	const growthRatePerMonth = growthRatePerDay * 30;

	return {
		current_stars: currentStars,
		total_growth: currentStars,
		growth_rate_per_day: Math.round(growthRatePerDay * 100) / 100,
		growth_rate_per_month: Math.round(growthRatePerMonth * 100) / 100,
		best_growth_day: findBestGrowthDay(historyPoints),
		worst_growth_day: findWorstGrowthDay(historyPoints),
		history_points: historyPoints,
		growth_trends: calculateGrowthTrends(historyPoints),
		milestones: calculateMilestones(historyPoints, currentStars),
	};
};

export const getSimpleStarHistory = (repository: GitHubRepository) => {
	const ageInDays = calculateAgeInDays(repository.created_at);
	const estimatedDailyGrowth =
		ageInDays > 0 ? repository.stargazers_count / ageInDays : 0;

	return {
		current_stars: repository.stargazers_count,
		estimated_daily_growth: Math.round(estimatedDailyGrowth * 100) / 100,
		repository_age_days: ageInDays,
		star_history_url: `https://star-history.com/#${repository.full_name}&Date`,
	};
};

// Influencer analytics
export const getInfluencerProfiles =
	(client: Octokit) =>
	async (
		stargazers: Array<{ login: string; starred_at: string | null }>,
		batchSize = 10,
		delayMs = 1000,
	): Promise<InfluencerDeveloper[]> => {
		const fetchUserProfile = async (stargazer: {
			login: string;
			starred_at: string | null;
		}) => {
			try {
				const response = await client.rest.users.getByUsername({
					username: stargazer.login,
				});

				const user = response.data;
				const accountAge = Math.floor(
					calculateAgeInDays(user.created_at) / 365,
				);
				const influenceScore = calculateInfluenceScore(
					user.followers,
					user.public_repos,
					accountAge,
				);

				return {
					login: user.login,
					id: user.id,
					name: user.name,
					avatar_url: user.avatar_url,
					html_url: user.html_url,
					followers: user.followers,
					following: user.following,
					public_repos: user.public_repos,
					public_gists: user.public_gists,
					bio: user.bio,
					company: user.company,
					location: user.location,
					blog: user.blog,
					twitter_username: user.twitter_username ?? null,
					created_at: user.created_at,
					starred_at: stargazer.starred_at,
					influence_score: influenceScore,
				};
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Failed to fetch user ${stargazer.login}:`, message);
				return null;
			}
		};

		return processInBatches(stargazers, fetchUserProfile, batchSize, delayMs);
	};

export const analyzeInfluencers = (
	influencers: InfluencerDeveloper[],
): InfluencerAnalytics => {
	const sortedInfluencers = [...influencers].sort(
		(a, b) => b.influence_score - a.influence_score,
	);

	const totalFollowers = sum(influencers.map((user) => user.followers));
	const averageFollowers =
		influencers.length > 0 ? totalFollowers / influencers.length : 0;

	return {
		total_stargazers_analyzed: influencers.length,
		total_followers_reached: totalFollowers,
		average_followers_per_stargazer: Math.round(averageFollowers),
		top_influencers: sortedInfluencers.slice(0, 50),
		influence_distribution: calculateInfluenceDistribution(influencers),
		geographic_distribution: calculateGeographicDistribution(influencers),
		company_distribution: calculateCompanyDistribution(influencers),
		metrics: calculateInfluenceMetrics(influencers, totalFollowers),
		notable_stargazers: identifyNotableStargazers(influencers),
	};
};

// Helper functions
const calculateInfluenceScore = (
	followers: number,
	repos: number,
	accountAgeYears: number,
): number => {
	const followerWeight = 0.6;
	const repoWeight = 0.2;
	const ageWeight = 0.2;

	const normalizedFollowers = Math.log10(followers + 1) * 10;
	const normalizedRepos = Math.min(repos / 10, 10);
	const normalizedAge = Math.min(accountAgeYears, 10);

	return (
		normalizedFollowers * followerWeight +
		normalizedRepos * repoWeight +
		normalizedAge * ageWeight
	);
};

const findBestGrowthDay = (historyPoints: StarHistoryPoint[]) => {
	const bestDay = historyPoints
		.filter((point) => point.change > 0)
		.reduce((max, point) => (point.change > max.change ? point : max), {
			change: 0,
			date: "",
			stars: 0,
		});

	return bestDay.change > 0
		? { date: bestDay.date, stars_gained: bestDay.change }
		: null;
};

const findWorstGrowthDay = (historyPoints: StarHistoryPoint[]) => {
	const worstDay = historyPoints
		.filter((point) => point.change < 0)
		.reduce((min, point) => (point.change < min.change ? point : min), {
			change: 0,
			date: "",
			stars: 0,
		});

	return worstDay.change < 0
		? { date: worstDay.date, stars_lost: Math.abs(worstDay.change) }
		: null;
};

const calculateGrowthTrends = (historyPoints: StarHistoryPoint[]) => {
	const calculateGrowthForPeriod = (days: number): number => {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);
		const cutoffStr = cutoffDate.toISOString().split("T")[0];

		const recentPoints = historyPoints.filter((p) => p.date >= cutoffStr);
		return sum(recentPoints.map((point) => point.change));
	};

	return {
		last_7_days: calculateGrowthForPeriod(7),
		last_30_days: calculateGrowthForPeriod(30),
		last_90_days: calculateGrowthForPeriod(90),
		last_year: calculateGrowthForPeriod(365),
	};
};

const calculateMilestones = (
	historyPoints: StarHistoryPoint[],
	currentStars: number,
) => {
	const milestoneTargets = [
		{ target: 1000, type: "1k" as const },
		{ target: 5000, type: "5k" as const },
		{ target: 10000, type: "10k" as const },
		{ target: 50000, type: "50k" as const },
		{ target: 100000, type: "100k" as const },
	];

	return milestoneTargets
		.filter(({ target }) => currentStars >= target)
		.map(({ target, type }) => {
			const milestonePoint = historyPoints.find(
				(point) => point.stars >= target,
			);
			return {
				stars: target,
				date: milestonePoint?.date || "",
				milestone_type: type,
			};
		})
		.filter((milestone) => milestone.date !== "");
};

const calculateInfluenceDistribution = (
	influencers: InfluencerDeveloper[],
) => ({
	mega_influencers: influencers.filter((u) => u.followers >= 10000).length,
	macro_influencers: influencers.filter(
		(u) => u.followers >= 1000 && u.followers < 10000,
	).length,
	micro_influencers: influencers.filter(
		(u) => u.followers >= 100 && u.followers < 1000,
	).length,
	regular_users: influencers.filter((u) => u.followers < 100).length,
});

const calculateGeographicDistribution = (
	influencers: InfluencerDeveloper[],
): Record<string, number> => {
	const distribution: Record<string, number> = {};
	influencers.forEach((user) => {
		if (user.location) {
			const location = user.location.trim();
			distribution[location] = (distribution[location] || 0) + 1;
		}
	});
	return distribution;
};

const calculateCompanyDistribution = (
	influencers: InfluencerDeveloper[],
): Record<string, number> => {
	const distribution: Record<string, number> = {};
	influencers.forEach((user) => {
		if (user.company) {
			const company = user.company.trim().replace("@", "");
			distribution[company] = (distribution[company] || 0) + 1;
		}
	});
	return distribution;
};

const calculateInfluenceMetrics = (
	influencers: InfluencerDeveloper[],
	totalFollowers: number,
) => {
	const sortedByFollowers = sortByField("followers", true)(influencers);
	const medianFollowers = median(influencers.map((inf) => inf.followers));

	const top10PercentCount = Math.ceil(sortedByFollowers.length * 0.1);
	const top10PercentFollowers = sum(
		sortedByFollowers.slice(0, top10PercentCount).map((user) => user.followers),
	);
	const influenceConcentration =
		totalFollowers > 0 ? (top10PercentFollowers / totalFollowers) * 100 : 0;

	return {
		total_potential_reach: totalFollowers,
		median_followers: medianFollowers,
		top_10_percent_followers: top10PercentFollowers,
		influence_concentration: Math.round(influenceConcentration * 100) / 100,
	};
};

const identifyNotableStargazers = (influencers: InfluencerDeveloper[]) => {
	const notable: Array<{
		login: string;
		followers: number;
		company: string | null;
		reason: string;
	}> = [];

	// High follower count
	influencers
		.filter((u) => u.followers >= 10000)
		.slice(0, 10)
		.forEach((user) => {
			notable.push({
				login: user.login,
				followers: user.followers,
				company: user.company,
				reason: `Mega influencer with ${user.followers.toLocaleString()} followers`,
			});
		});

	// Notable companies
	const notableCompanies = [
		"GitHub",
		"Microsoft",
		"Google",
		"Meta",
		"Apple",
		"Netflix",
		"Amazon",
		"Vercel",
		"Stripe",
	];
	influencers
		.filter(
			(u) =>
				u.company &&
				notableCompanies.some((company) =>
					u.company?.toLowerCase().includes(company.toLowerCase()),
				),
		)
		.slice(0, 5)
		.forEach((user) => {
			notable.push({
				login: user.login,
				followers: user.followers,
				company: user.company,
				reason: `Works at notable company: ${user.company}`,
			});
		});

	// High influence score
	const topInfluencers = [...influencers].sort(
		(a, b) => b.influence_score - a.influence_score,
	);
	topInfluencers.slice(0, 5).forEach((user) => {
		if (!notable.some((n) => n.login === user.login)) {
			notable.push({
				login: user.login,
				followers: user.followers,
				company: user.company,
				reason: `High influence score (${Math.round(user.influence_score)})`,
			});
		}
	});

	return notable.slice(0, 20);
};

// Rate limit aware analysis planning
export const calculateOptimalAnalysisLimit = async (
	client: Octokit,
): Promise<{
	analysisLimit: number;
	shouldUseAllStargazers: boolean;
}> => {
	try {
		// Check if we have a GitHub token
		const hasToken = !!process.env.GITHUB_TOKEN;

		// Get current rate limit status
		const rateLimitResponse = await client.rest.rateLimit.get();
		const { core } = rateLimitResponse.data.resources;

		const remainingRequests = core.remaining;
		const resetTime = new Date(core.reset * 1000);
		const now = new Date();
		const minutesUntilReset = Math.max(
			0,
			(resetTime.getTime() - now.getTime()) / (1000 * 60),
		);

		console.error(
			`Rate limit status: ${remainingRequests}/${core.limit} remaining, resets in ${Math.round(minutesUntilReset)} minutes`,
		);

		// Calculate analysis limits based on available requests
		// Each user profile requires 1 request
		// Stargazer fetching: ~10-100 requests depending on repo size

		let analysisLimit: number;
		let shouldUseAllStargazers: boolean;

		if (!hasToken) {
			// Unauthenticated: 60 requests/hour - very conservative
			analysisLimit = Math.min(25, remainingRequests - 10); // Save 10 requests for stargazer fetching
			shouldUseAllStargazers = false;
			console.error(`No GitHub token detected - using conservative limits`);
		} else if (remainingRequests > 2000) {
			// Plenty of requests available - analyze ALL stargazers
			analysisLimit = Math.min(remainingRequests - 100, 50000); // Allow up to 50k stargazers or remaining requests minus buffer
			shouldUseAllStargazers = true;
			console.error(
				`High rate limit available - analyzing ALL stargazers (up to ${analysisLimit})`,
			);
		} else if (remainingRequests > 500) {
			// Moderate requests - good analysis
			analysisLimit = Math.min(remainingRequests - 100, 10000); // Allow up to 10k stargazers with moderate limits
			shouldUseAllStargazers = true;
			console.error(
				`Moderate rate limit - analyzing up to ${analysisLimit} stargazers`,
			);
		} else if (remainingRequests > 100) {
			// Low requests - limited analysis
			analysisLimit = Math.min(100, remainingRequests - 20);
			shouldUseAllStargazers = false;
			console.error(`Low rate limit - using limited analysis`);
		} else {
			// Very low requests - minimal analysis
			analysisLimit = Math.max(10, remainingRequests - 5);
			shouldUseAllStargazers = false;
			console.error(`Very low rate limit - using minimal analysis`);
		}

		// Ensure we don't go below reasonable minimums
		analysisLimit = Math.max(10, analysisLimit);

		return {
			analysisLimit,
			shouldUseAllStargazers,
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(
			`Failed to check rate limits, using safe defaults: ${message}`,
		);

		// Safe fallback when rate limit check fails
		const hasToken = !!process.env.GITHUB_TOKEN;
		return {
			analysisLimit: hasToken ? 5000 : 50, // More generous fallback when authenticated
			shouldUseAllStargazers: hasToken,
		};
	}
};
