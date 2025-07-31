/**
 * Release and download analytics operations
 */
import type { Octokit } from "@octokit/rest";
import type {
	DownloadStats,
	GitHubRelease,
	ReleaseAnalytics,
} from "../types.js";
import {
	calculateDaysBetween,
	parseRepoIdentifier,
	sum,
	withErrorHandling,
} from "../utils/helpers.js";

// Release fetching operations
export const getReleases = (client: Octokit) =>
	withErrorHandling(
		async (identifier: string, limit = 10): Promise<GitHubRelease[]> => {
			const { owner, repo } = parseRepoIdentifier(identifier);

			try {
				const response = await client.rest.repos.listReleases({
					owner,
					repo,
					per_page: limit as number,
				});
				return response.data;
			} catch (error: unknown) {
				// Handle 404 or other errors gracefully - repository might not have releases
				if (
					error &&
					typeof error === "object" &&
					"status" in error &&
					error.status === 404
				) {
					console.warn(
						`No releases found for ${identifier} or repository not accessible`,
					);
					return [];
				}
				throw error;
			}
		},
		"Failed to fetch releases",
	);

export const getAllReleases = (client: Octokit) =>
	withErrorHandling(async (identifier: string): Promise<GitHubRelease[]> => {
		const { owner, repo } = parseRepoIdentifier(identifier);

		try {
			const releases: GitHubRelease[] = [];
			let page = 1;
			let hasMore = true;

			while (hasMore) {
				const response = await client.rest.repos.listReleases({
					owner,
					repo,
					per_page: 100,
					page,
				});

				releases.push(...response.data);
				hasMore = response.data.length === 100;
				page++;
			}

			return releases;
		} catch (error: unknown) {
			// Handle 404 or other errors gracefully - repository might not have releases
			if (
				error &&
				typeof error === "object" &&
				"status" in error &&
				error.status === 404
			) {
				console.warn(
					`No releases found for ${identifier} or repository not accessible`,
				);
				return [];
			}
			throw error;
		}
	}, "Failed to fetch all releases");

export const getLatestRelease = (client: Octokit) =>
	withErrorHandling(
		async (identifier: string): Promise<GitHubRelease | null> => {
			const { owner, repo } = parseRepoIdentifier(identifier);
			try {
				const response = await client.rest.repos.getLatestRelease({
					owner,
					repo,
				});
				return response.data;
			} catch (error: unknown) {
				if (
					error &&
					typeof error === "object" &&
					"status" in error &&
					error.status === 404
				) {
					return null;
				}
				throw error;
			}
		},
		"Failed to fetch latest release",
	);

// Release analytics calculations
export const calculateReleaseMetrics = (
	releases: GitHubRelease[],
): ReleaseAnalytics => {
	if (!Array.isArray(releases) || releases.length === 0) {
		return createEmptyReleaseAnalytics();
	}

	const downloadTrends = releases.map((release) => ({
		tag_name: release.tag_name,
		total_downloads: calculateReleaseDownloads(release),
		asset_breakdown: release.assets
			.map((asset) => ({
				name: asset.name,
				downloads: asset.download_count,
				size_mb: Math.round((asset.size / (1024 * 1024)) * 100) / 100,
			}))
			.sort((a, b) => b.downloads - a.downloads),
	}));

	const totalDownloads = sum(
		downloadTrends.map((trend) => trend.total_downloads),
	);
	const totalAssets = sum(releases.map((release) => release.assets.length));
	const averageDownloads =
		releases.length > 0 ? Math.round(totalDownloads / releases.length) : 0;

	const sortedDownloadTrends = [...downloadTrends].sort(
		(a, b) => b.total_downloads - a.total_downloads,
	);
	const mostDownloadedRelease = sortedDownloadTrends[0];
	const correspondingRelease = releases.find(
		(r) => r.tag_name === mostDownloadedRelease?.tag_name,
	);

	return {
		total_releases: releases.length,
		total_downloads: totalDownloads,
		total_assets: totalAssets,
		average_downloads_per_release: averageDownloads,
		most_downloaded_release:
			mostDownloadedRelease && correspondingRelease
				? {
						tag_name: correspondingRelease.tag_name,
						name: correspondingRelease.name,
						downloads: mostDownloadedRelease.total_downloads,
						published_at: correspondingRelease.published_at,
					}
				: null,
		latest_release: releases.find((r) => !r.draft) || null,
		release_frequency: calculateReleaseFrequency(releases),
		download_trends: downloadTrends,
		asset_types: calculateAssetTypes(releases),
		prerelease_stats: calculatePrereleaseStats(releases),
	};
};

export const calculateDownloadStats = (
	releases: GitHubRelease[],
): DownloadStats => {
	if (!Array.isArray(releases) || releases.length === 0) {
		return {
			total_downloads: 0,
			downloads_by_release: [],
			top_assets: [],
			download_distribution: { by_file_type: {}, by_size_range: {} },
		};
	}

	const downloadsByRelease = releases.map((release) => {
		const assets = release.assets.map((asset) => ({
			name: asset.name,
			downloads: asset.download_count,
			size_mb: Math.round((asset.size / (1024 * 1024)) * 100) / 100,
			content_type: asset.content_type,
		}));

		const sortedAssets = [...assets].sort((a, b) => b.downloads - a.downloads);

		return {
			tag_name: release.tag_name,
			name: release.name,
			published_at: release.published_at,
			total_downloads: sum(assets.map((asset) => asset.downloads)),
			assets: sortedAssets,
		};
	});

	const sortedByDownloads = [...downloadsByRelease].sort(
		(a, b) => b.total_downloads - a.total_downloads,
	);

	const allAssets = releases.flatMap((release) =>
		release.assets.map((asset) => ({
			name: asset.name,
			release_tag: release.tag_name,
			downloads: asset.download_count,
			size_mb: Math.round((asset.size / (1024 * 1024)) * 100) / 100,
		})),
	);

	const sortedAssets = [...allAssets].sort((a, b) => b.downloads - a.downloads);
	const topAssets = sortedAssets.slice(0, 20);
	const totalDownloads = sum(allAssets.map((asset) => asset.downloads));

	return {
		total_downloads: totalDownloads,
		downloads_by_release: sortedByDownloads,
		top_assets: topAssets,
		download_distribution: calculateDownloadDistribution(allAssets),
	};
};

// Helper functions
const createEmptyReleaseAnalytics = (): ReleaseAnalytics => ({
	total_releases: 0,
	total_downloads: 0,
	total_assets: 0,
	average_downloads_per_release: 0,
	most_downloaded_release: null,
	latest_release: null,
	release_frequency: {
		days_between_releases: 0,
		releases_per_month: 0,
		releases_per_year: 0,
	},
	download_trends: [],
	asset_types: {},
	prerelease_stats: {
		total_prereleases: 0,
		percentage_prereleases: 0,
	},
});

const calculateReleaseDownloads = (release: GitHubRelease): number =>
	sum(release.assets.map((asset) => asset.download_count));

const calculateReleaseFrequency = (releases: GitHubRelease[]) => {
	const publishedReleases = releases.filter((r) => r.published_at && !r.draft);

	if (publishedReleases.length <= 1) {
		return {
			days_between_releases: 0,
			releases_per_month: 0,
			releases_per_year: 0,
		};
	}

	const sortedReleases = publishedReleases.sort(
		(a, b) =>
			new Date(a.published_at || "").getTime() -
			new Date(b.published_at || "").getTime(),
	);

	const totalDays = calculateDaysBetween(
		sortedReleases[0].published_at || "",
		sortedReleases[sortedReleases.length - 1].published_at || "",
	);

	const daysBetweenReleases = totalDays / (sortedReleases.length - 1);

	return {
		days_between_releases: Math.round(daysBetweenReleases * 100) / 100,
		releases_per_month:
			daysBetweenReleases > 0
				? Math.round((30 / daysBetweenReleases) * 100) / 100
				: 0,
		releases_per_year:
			daysBetweenReleases > 0
				? Math.round((365 / daysBetweenReleases) * 100) / 100
				: 0,
	};
};

const calculateAssetTypes = (releases: GitHubRelease[]) => {
	const assetTypes: Record<
		string,
		{ count: number; total_downloads: number; total_size_mb: number }
	> = {};

	releases.forEach((release) => {
		release.assets.forEach((asset) => {
			const extension = asset.name.split(".").pop()?.toLowerCase() || "unknown";
			const sizeMb = asset.size / (1024 * 1024);

			if (!assetTypes[extension]) {
				assetTypes[extension] = {
					count: 0,
					total_downloads: 0,
					total_size_mb: 0,
				};
			}

			assetTypes[extension].count++;
			assetTypes[extension].total_downloads += asset.download_count;
			assetTypes[extension].total_size_mb += sizeMb;
		});
	});

	Object.keys(assetTypes).forEach((type) => {
		assetTypes[type].total_size_mb =
			Math.round(assetTypes[type].total_size_mb * 100) / 100;
	});

	return assetTypes;
};

const calculatePrereleaseStats = (releases: GitHubRelease[]) => {
	const prereleases = releases.filter((r) => r.prerelease);

	return {
		total_prereleases: prereleases.length,
		percentage_prereleases:
			releases.length > 0
				? Math.round((prereleases.length / releases.length) * 10000) / 100
				: 0,
	};
};

const calculateDownloadDistribution = (
	assets: Array<{ name: string; downloads: number; size_mb: number }>,
) => {
	const byFileType: Record<string, number> = {};
	const bySizeRange: Record<string, number> = {
		"< 1MB": 0,
		"1-10MB": 0,
		"10-100MB": 0,
		"100MB-1GB": 0,
		"> 1GB": 0,
	};

	assets.forEach((asset) => {
		const extension = asset.name.split(".").pop()?.toLowerCase() || "unknown";
		byFileType[extension] = (byFileType[extension] || 0) + asset.downloads;

		if (asset.size_mb < 1) {
			bySizeRange["< 1MB"] += asset.downloads;
		} else if (asset.size_mb < 10) {
			bySizeRange["1-10MB"] += asset.downloads;
		} else if (asset.size_mb < 100) {
			bySizeRange["10-100MB"] += asset.downloads;
		} else if (asset.size_mb < 1024) {
			bySizeRange["100MB-1GB"] += asset.downloads;
		} else {
			bySizeRange["> 1GB"] += asset.downloads;
		}
	});

	return { by_file_type: byFileType, by_size_range: bySizeRange };
};
