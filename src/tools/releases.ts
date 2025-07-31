import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { RepositoryArgs, LimitArgs, GitHubRelease } from '../types.js';
import type { GitHubService } from '../github/index.js';

// Releases-related tool definitions
export const releasesTools: Tool[] = [
  {
    name: 'get_releases',
    description: 'Get list of releases for a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository identifier (owner/repo) or full GitHub URL'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of releases to return (default: 10)',
          default: 10
        }
      },
      required: ['repository']
    }
  },
  {
    name: 'get_all_releases',
    description: 'Get all releases for a repository (not limited to recent ones)',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository identifier (owner/repo) or full GitHub URL'
        }
      },
      required: ['repository']
    }
  },
  {
    name: 'get_latest_release',
    description: 'Get the latest release information with full details',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository identifier (owner/repo) or full GitHub URL'
        }
      },
      required: ['repository']
    }
  },
  {
    name: 'get_release_analytics',
    description: 'Get comprehensive release analytics including download stats, release frequency, and asset analysis',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository identifier (owner/repo) or full GitHub URL'
        }
      },
      required: ['repository']
    }
  },
  {
    name: 'get_download_stats',
    description: 'Get detailed download statistics for all releases and assets',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository identifier (owner/repo) or full GitHub URL'
        }
      },
      required: ['repository']
    }
  }
];

// Releases tool handlers
export const createReleasesHandlers = (github: GitHubService, truncateResponse: any) => ({
  get_releases: async (args: LimitArgs, maxChars?: number) => {
    const result = await github.getReleases(args.repository, args.limit || 10);
    
    // Include all releases but with only essential fields
    const condensedReleases = result.map(release => ({
      tag_name: release.tag_name,
      name: release.name,
      published_at: release.published_at,
      prerelease: release.prerelease,
      assets_count: release.assets?.length || 0,
      total_downloads: release.assets?.reduce((sum, asset) => sum + (asset.download_count || 0), 0) || 0
    }));

    const responseData = {
      total_releases: condensedReleases.length,
      releases: condensedReleases
    };

    const { data: finalData } = truncateResponse(responseData, 'releases', maxChars);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(finalData, null, 2)
        }
      ]
    };
  },

  get_all_releases: async (args: RepositoryArgs, maxChars?: number) => {
    const result = await github.getAllReleases(args.repository);
    
    // Include all releases but with only essential fields
    const condensedReleases = result.map((release: GitHubRelease) => ({
      tag_name: release.tag_name,
      name: release.name,
      published_at: release.published_at,
      prerelease: release.prerelease,
      assets_count: release.assets?.length || 0,
      total_downloads: release.assets?.reduce((sum, asset) => sum + (asset.download_count || 0), 0) || 0
    }));

    const responseData = {
      total_releases: condensedReleases.length,
      releases: condensedReleases
    };

    const { data: finalData } = truncateResponse(responseData, 'releases', maxChars);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(finalData, null, 2)
        }
      ]
    };
  },

  get_latest_release: async (args: RepositoryArgs) => {
    const result = await github.getLatestRelease(args.repository);
    return {
      content: [
        {
          type: 'text',
          text: result ? JSON.stringify(result, null, 2) : 'No releases found'
        }
      ]
    };
  },

  get_release_analytics: async (args: RepositoryArgs) => {
    const result = await github.getReleaseAnalytics(args.repository);
    
    // Return condensed analytics to stay within token limits
    const condensedAnalytics = {
      total_releases: result.total_releases,
      total_downloads: result.total_downloads,
      total_assets: result.total_assets,
      average_downloads_per_release: result.average_downloads_per_release,
      most_downloaded_release: result.most_downloaded_release,
      latest_release: result.latest_release,
      release_frequency: result.release_frequency,
      asset_types: result.asset_types,
      prerelease_stats: result.prerelease_stats,
      top_10_download_trends: result.download_trends.slice(0, 10).map(trend => ({
        tag_name: trend.tag_name,
        total_downloads: trend.total_downloads,
        top_3_assets: trend.asset_breakdown.slice(0, 3)
      }))
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(condensedAnalytics, null, 2)
        }
      ]
    };
  },

  get_download_stats: async (args: RepositoryArgs) => {
    const result = await github.getDownloadStats(args.repository);
    
    // Return condensed download stats to stay within token limits
    const condensedStats = {
      total_downloads: result.total_downloads,
      top_10_releases: result.downloads_by_release.slice(0, 10).map(release => ({
        tag_name: release.tag_name,
        total_downloads: release.total_downloads,
        published_at: release.published_at,
        top_assets: release.assets.slice(0, 3).map(asset => ({
          name: asset.name,
          downloads: asset.downloads,
          size_mb: asset.size_mb
        }))
      })),
      top_10_assets: result.top_assets.slice(0, 10),
      download_distribution: result.download_distribution
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(condensedStats, null, 2)
        }
      ]
    };
  }
});