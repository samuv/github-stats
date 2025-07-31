/**
 * GitHub service interface - main entry point for all GitHub operations
 */
import type {
	DownloadStats,
	GitHubStargazer,
	GitHubStats,
	InfluencerAnalytics,
	ReleaseAnalytics,
	StarHistoryAnalytics,
} from "../types.js";

import { createClient, defaultClient, type GitHubConfig } from "./client.js";
import {
	calculateDownloadStats,
	calculateReleaseMetrics,
	getAllReleases,
	getLatestRelease,
	getReleases,
} from "./releases.js";
import {
	analyzeCommitActivity,
	calculateLanguageBreakdown,
	getCommitActivity,
	getContributors,
	getLanguages,
	getOpenIssues,
	getOpenPullRequests,
	getRepository,
	getTrafficReferrers,
	searchRepositories,
} from "./repository.js";
import {
	analyzeInfluencers,
	calculateOptimalAnalysisLimit,
	calculateStarHistory,
	getAllStargazersWithTimestamps,
	getInfluencerProfiles,
	getSimpleStarHistory,
	getStargazersWithTimestamps,
} from "./stargazers.js";

export interface GitHubServiceConfig extends GitHubConfig {
	batchSize?: number;
	delayBetweenBatches?: number;
}

export const createGitHubService = (config: GitHubServiceConfig = {}) => {
	const client = config.token ? createClient(config) : defaultClient;
	const batchSize = config.batchSize || 10;
	const delayMs = config.delayBetweenBatches || 1000;

	// Repository operations
	const repositoryOps = {
		getRepository: getRepository(client),
		getLanguages: getLanguages(client),
		getLanguageBreakdown: async (identifier: string) => {
			const languages = await getLanguages(client)(identifier);
			return calculateLanguageBreakdown(languages);
		},
		getContributors: getContributors(client),
		getCommitActivity: getCommitActivity(client),
		getCommitActivitySummary: async (identifier: string) => {
			const activity = await getCommitActivity(client)(identifier);
			return analyzeCommitActivity(activity);
		},
		getOpenIssues: getOpenIssues(client),
		getOpenPullRequests: getOpenPullRequests(client),
		searchRepositories: searchRepositories(client),
		getTrafficReferrers: getTrafficReferrers(client),
	};

	// Release operations
	const releaseOps = {
		getReleases: getReleases(client),
		getAllReleases: getAllReleases(client),
		getLatestRelease: getLatestRelease(client),
		getReleaseAnalytics: async (
			identifier: string,
		): Promise<ReleaseAnalytics> => {
			const releases = await getAllReleases(client)(identifier);
			return calculateReleaseMetrics(releases);
		},
		getDownloadStats: async (identifier: string): Promise<DownloadStats> => {
			const releases = await getAllReleases(client)(identifier);
			return calculateDownloadStats(releases);
		},
	};

	// Star operations
	const starOps = {
		getStarHistory: async (
			identifier: string,
		): Promise<StarHistoryAnalytics> => {
			const [repository, stargazers] = await Promise.all([
				repositoryOps.getRepository(identifier),
				getStargazersWithTimestamps(client)(identifier, 1000),
			]);
			return calculateStarHistory(repository, stargazers);
		},
		getCompleteStarHistory: async (
			identifier: string,
		): Promise<StarHistoryAnalytics> => {
			console.error(`Fetching COMPLETE star history for ${identifier}...`);
			const [repository, stargazers] = await Promise.all([
				repositoryOps.getRepository(identifier),
				getAllStargazersWithTimestamps(client)(identifier),
			]);
			console.error(
				`Analyzing ${stargazers.length} total stargazers for complete history...`,
			);
			return calculateStarHistory(repository, stargazers);
		},
		getSimpleStarHistory: async (identifier: string) => {
			const repository = await repositoryOps.getRepository(identifier);
			return getSimpleStarHistory(repository);
		},
		getInfluencerAnalytics: async (
			identifier: string,
			returnLimit = 100,
		): Promise<InfluencerAnalytics> => {
			console.error(`Analyzing influencer stargazers for ${identifier}...`);

			// Check rate limit status and adjust analysis accordingly
			const { analysisLimit, shouldUseAllStargazers } =
				await calculateOptimalAnalysisLimit(client);
			console.error(
				`Rate limit check: Will analyze up to ${analysisLimit} stargazers (token: ${process.env.GITHUB_TOKEN ? "yes" : "no"})`,
			);

			let stargazers: GitHubStargazer[];
			if (shouldUseAllStargazers) {
				// Get ALL stargazers when we have good rate limits
				const allStargazers =
					await getAllStargazersWithTimestamps(client)(identifier);
				console.error(`Found ${allStargazers.length} total stargazers`);

				// Prioritize recent stargazers as they're more likely to be active and influential
				const stargazersToAnalyze =
					allStargazers.length > analysisLimit
						? allStargazers.slice(-analysisLimit)
						: allStargazers;
				stargazers = stargazersToAnalyze;
			} else {
				// Limited analysis when rate limits are tight
				console.error(`Using limited analysis due to rate limits`);
				stargazers = await getStargazersWithTimestamps(client)(
					identifier,
					analysisLimit,
				);
			}

			console.error(
				`Analyzing detailed profiles for ${stargazers.length} stargazers...`,
			);

			const influencers = await getInfluencerProfiles(client)(
				stargazers,
				batchSize,
				delayMs,
			);
			console.error(
				`Successfully analyzed ${influencers.length} influencer profiles`,
			);

			const result = analyzeInfluencers(influencers);

			// Trim to requested number of top influencers
			if (
				result.top_influencers &&
				result.top_influencers.length > returnLimit
			) {
				result.top_influencers = result.top_influencers.slice(0, returnLimit);
			}

			return result;
		},
		getStargazers: async (identifier: string, limit = 100) => {
			console.error(`Fetching up to ${limit} stargazers for ${identifier}...`);
			return getStargazersWithTimestamps(client)(identifier, limit);
		},
		getAllStargazers: async (identifier: string) => {
			console.error(`Fetching ALL stargazers for ${identifier}...`);
			return getAllStargazersWithTimestamps(client)(identifier);
		},
	};

	// Comprehensive operations
	const comprehensiveOps = {
		getComprehensiveStats: async (identifier: string): Promise<GitHubStats> => {
			const [
				repository,
				languages,
				contributors,
				releases,
				commitActivity,
				openIssues,
				openPullRequests,
				releaseAnalytics,
				downloadStats,
				starHistory,
			] = await Promise.all([
				repositoryOps.getRepository(identifier),
				repositoryOps.getLanguages(identifier),
				repositoryOps.getContributors(identifier, 30),
				releaseOps.getReleases(identifier, 10),
				repositoryOps.getCommitActivity(identifier),
				repositoryOps.getOpenIssues(identifier, 30),
				repositoryOps.getOpenPullRequests(identifier, 30),
				releaseOps.getReleaseAnalytics(identifier),
				releaseOps.getDownloadStats(identifier),
				starOps.getStarHistory(identifier),
			]);

			return {
				repository,
				languages,
				contributors,
				releases,
				commitActivity,
				openIssues,
				openPullRequests,
				releaseAnalytics,
				downloadStats,
				starHistory,
			};
		},
	};

	return {
		...repositoryOps,
		...releaseOps,
		...starOps,
		...comprehensiveOps,
	};
};

export type GitHubService = ReturnType<typeof createGitHubService>;

// Default service instance
export const githubService = createGitHubService();
