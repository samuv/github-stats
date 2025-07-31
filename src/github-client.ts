import { Octokit } from '@octokit/rest';
import type {
  GitHubRepository,
  GitHubLanguageStats,
  GitHubContributor,
  GitHubRelease,
  GitHubCommitActivity,
  GitHubCommitActivityResponse,
  GitHubPullRequest,
  GitHubIssue,
  GitHubStats,
  ReleaseAnalytics,
  DownloadStats,
  StarHistoryAnalytics,
  StarHistoryPoint,
  InfluencerDeveloper,
  InfluencerAnalytics,
  GitHubSearchRepository
} from './types.js';
import { withRetry } from './utils/helpers.js';

export class GitHubClient {
  private octokit: Octokit;

  constructor(authToken?: string) {
    this.octokit = new Octokit({
      auth: authToken,
      userAgent: 'github-stats-mcp/1.0.0'
    });
  }

  /**
   * Parse a GitHub repository URL or full name into owner and repo
   */
  private parseRepoIdentifier(repoIdentifier: string): { owner: string; repo: string } {
    // Handle full URLs like https://github.com/owner/repo
    if (repoIdentifier.startsWith('http')) {
      const url = new URL(repoIdentifier);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length >= 2) {
        return { owner: pathParts[0], repo: pathParts[1] };
      }
      throw new Error('Invalid GitHub URL format');
    }

    // Handle owner/repo format
    const parts = repoIdentifier.split('/');
    if (parts.length === 2) {
      return { owner: parts[0], repo: parts[1] };
    }

    throw new Error('Repository identifier must be in format "owner/repo" or a full GitHub URL');
  }

  /**
   * Get basic repository information
   */
  async getRepository(repoIdentifier: string): Promise<GitHubRepository> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      
      return response.data;
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found`);
      }
      throw new Error(`Failed to fetch repository: ${error.message}`);
    }
  }

  /**
   * Get language statistics for a repository
   */
  async getLanguageStats(repoIdentifier: string): Promise<GitHubLanguageStats> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      const response = await this.octokit.rest.repos.listLanguages({
        owner,
        repo
      });
      
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch language stats: ${error.message}`);
    }
  }

  /**
   * Get repository contributors
   */
  async getContributors(repoIdentifier: string, limit: number = 30): Promise<GitHubContributor[]> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      const response = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: limit
      });
      
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch contributors: ${error.message}`);
    }
  }

  /**
   * Get repository releases
   */
  async getReleases(repoIdentifier: string, limit: number = 10): Promise<GitHubRelease[]> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      const response = await this.octokit.rest.repos.listReleases({
        owner,
        repo,
        per_page: limit
      });
      
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch releases: ${error.message}`);
    }
  }

  /**
   * Get commit activity statistics with retry logic
   */
  async getCommitActivity(repoIdentifier: string): Promise<GitHubCommitActivity[]> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      // Use retry logic to handle GitHub's statistics computation delay
      const data = await withRetry(
        async (): Promise<GitHubCommitActivityResponse> => {
          const response = await this.octokit.rest.repos.getCommitActivityStats({
            owner,
            repo
          });
          return response.data;
        },
        (data: GitHubCommitActivityResponse): data is GitHubCommitActivity[] => {
          // Consider the result valid if it's an array with data
          return Array.isArray(data) && data.length > 0;
        },
        10, // maxRetries
        1000 // delayMs (1 second)
      );
      
      // TypeScript now knows data is GitHubCommitActivity[]
      return data;
    } catch (error: any) {
      throw new Error(`Failed to fetch commit activity: ${error.message}`);
    }
  }

  /**
   * Get open issues
   */
  async getOpenIssues(repoIdentifier: string, limit: number = 30): Promise<GitHubIssue[]> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      const response = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'open',
        per_page: limit
      });
      
      // Filter out pull requests (GitHub API includes PRs in issues)
      return response.data.filter(issue => !issue.pull_request);
    } catch (error: any) {
      throw new Error(`Failed to fetch open issues: ${error.message}`);
    }
  }

  /**
   * Get open pull requests
   */
  async getOpenPullRequests(repoIdentifier: string, limit: number = 30): Promise<GitHubPullRequest[]> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      const response = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: 'open',
        per_page: limit
      });
      
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch open pull requests: ${error.message}`);
    }
  }

  /**
   * Get comprehensive repository statistics
   */
  async getComprehensiveStats(repoIdentifier: string): Promise<GitHubStats> {
    try {
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
        starHistory
      ] = await Promise.all([
        this.getRepository(repoIdentifier),
        this.getLanguageStats(repoIdentifier),
        this.getContributors(repoIdentifier),
        this.getReleases(repoIdentifier),
        this.getCommitActivity(repoIdentifier),
        this.getOpenIssues(repoIdentifier),
        this.getOpenPullRequests(repoIdentifier),
        this.getReleaseAnalytics(repoIdentifier),
        this.getDownloadStats(repoIdentifier),
        this.getStarHistory(repoIdentifier)
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
        starHistory
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch comprehensive stats: ${error.message}`);
    }
  }

  /**
   * Search repositories
   */
  async searchRepositories(query: string, limit: number = 10): Promise<GitHubSearchRepository[]> {
    try {
      const response = await this.octokit.rest.search.repos({
        q: query,
        per_page: limit,
        sort: 'stars',
        order: 'desc'
      });
      
      return response.data.items;
    } catch (error: any) {
      throw new Error(`Failed to search repositories: ${error.message}`);
    }
  }

  /**
   * Get all releases for comprehensive analysis
   */
  async getAllReleases(repoIdentifier: string): Promise<GitHubRelease[]> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      const releases: GitHubRelease[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.octokit.rest.repos.listReleases({
          owner,
          repo,
          per_page: 100,
          page
        });

        releases.push(...response.data);
        hasMore = response.data.length === 100;
        page++;
      }

      return releases;
    } catch (error: any) {
      throw new Error(`Failed to fetch all releases: ${error.message}`);
    }
  }

  /**
   * Get comprehensive release analytics
   */
  async getReleaseAnalytics(repoIdentifier: string): Promise<ReleaseAnalytics> {
    try {
      const releases = await this.getAllReleases(repoIdentifier);

      if (releases.length === 0) {
        return {
          total_releases: 0,
          total_downloads: 0,
          total_assets: 0,
          average_downloads_per_release: 0,
          most_downloaded_release: null,
          latest_release: null,
          release_frequency: {
            days_between_releases: 0,
            releases_per_month: 0,
            releases_per_year: 0
          },
          download_trends: [],
          asset_types: {},
          prerelease_stats: {
            total_prereleases: 0,
            percentage_prereleases: 0
          }
        };
      }

      // Calculate total downloads and assets
      let totalDownloads = 0;
      let totalAssets = 0;
      const downloadTrends: Array<{
        tag_name: string;
        total_downloads: number;
        asset_breakdown: Array<{
          name: string;
          downloads: number;
          size_mb: number;
        }>;
      }> = [];

      const assetTypes: Record<string, {
        count: number;
        total_downloads: number;
        total_size_mb: number;
      }> = {};

      releases.forEach(release => {
        let releaseDownloads = 0;
        const assetBreakdown: Array<{
          name: string;
          downloads: number;
          size_mb: number;
        }> = [];

        release.assets.forEach(asset => {
          const downloads = asset.download_count;
          const sizeMb = asset.size / (1024 * 1024);
          
          releaseDownloads += downloads;
          totalDownloads += downloads;
          totalAssets++;

          assetBreakdown.push({
            name: asset.name,
            downloads,
            size_mb: Math.round(sizeMb * 100) / 100
          });

          // Track asset types
          const extension = asset.name.split('.').pop()?.toLowerCase() || 'unknown';
          if (!assetTypes[extension]) {
            assetTypes[extension] = {
              count: 0,
              total_downloads: 0,
              total_size_mb: 0
            };
          }
          assetTypes[extension].count++;
          assetTypes[extension].total_downloads += downloads;
          assetTypes[extension].total_size_mb += sizeMb;
        });

        downloadTrends.push({
          tag_name: release.tag_name,
          total_downloads: releaseDownloads,
          asset_breakdown: assetBreakdown.sort((a, b) => b.downloads - a.downloads)
        });
      });

      // Sort releases by downloads to find most downloaded
      const releasesByDownloads = downloadTrends.sort((a, b) => b.total_downloads - a.total_downloads);
      const mostDownloadedRelease = releasesByDownloads[0];
      const correspondingRelease = releases.find(r => r.tag_name === mostDownloadedRelease?.tag_name);

      // Calculate release frequency
      const publishedReleases = releases.filter(r => r.published_at && !r.draft);
      let daysBetweenReleases = 0;
      if (publishedReleases.length > 1) {
        const sortedReleases = publishedReleases.sort((a, b) => 
          new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime()
        );
        const firstDate = new Date(sortedReleases[0].published_at!);
        const lastDate = new Date(sortedReleases[sortedReleases.length - 1].published_at!);
        const totalDays = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
        daysBetweenReleases = totalDays / (sortedReleases.length - 1);
      }

      // Count prereleases
      const prereleases = releases.filter(r => r.prerelease);

      // Round asset type sizes
      Object.keys(assetTypes).forEach(type => {
        assetTypes[type].total_size_mb = Math.round(assetTypes[type].total_size_mb * 100) / 100;
      });

      return {
        total_releases: releases.length,
        total_downloads: totalDownloads,
        total_assets: totalAssets,
        average_downloads_per_release: releases.length > 0 ? Math.round(totalDownloads / releases.length) : 0,
        most_downloaded_release: mostDownloadedRelease && correspondingRelease ? {
          tag_name: correspondingRelease.tag_name,
          name: correspondingRelease.name,
          downloads: mostDownloadedRelease.total_downloads,
          published_at: correspondingRelease.published_at
        } : null,
        latest_release: releases.find(r => !r.draft) || null,
        release_frequency: {
          days_between_releases: Math.round(daysBetweenReleases * 100) / 100,
          releases_per_month: daysBetweenReleases > 0 ? Math.round((30 / daysBetweenReleases) * 100) / 100 : 0,
          releases_per_year: daysBetweenReleases > 0 ? Math.round((365 / daysBetweenReleases) * 100) / 100 : 0
        },
        download_trends: downloadTrends,
        asset_types: assetTypes,
        prerelease_stats: {
          total_prereleases: prereleases.length,
          percentage_prereleases: releases.length > 0 ? Math.round((prereleases.length / releases.length) * 10000) / 100 : 0
        }
      };
    } catch (error: any) {
      throw new Error(`Failed to get release analytics: ${error.message}`);
    }
  }

  /**
   * Get detailed download statistics
   */
  async getDownloadStats(repoIdentifier: string): Promise<DownloadStats> {
    try {
      const releases = await this.getAllReleases(repoIdentifier);

      const downloadsByRelease = releases.map(release => {
        const assets = release.assets.map(asset => ({
          name: asset.name,
          downloads: asset.download_count,
          size_mb: Math.round((asset.size / (1024 * 1024)) * 100) / 100,
          content_type: asset.content_type
        }));

        return {
          tag_name: release.tag_name,
          name: release.name,
          published_at: release.published_at,
          total_downloads: assets.reduce((sum, asset) => sum + asset.downloads, 0),
          assets: assets.sort((a, b) => b.downloads - a.downloads)
        };
      }).sort((a, b) => b.total_downloads - a.total_downloads);

      // Get top assets across all releases
      const allAssets: Array<{
        name: string;
        release_tag: string;
        downloads: number;
        size_mb: number;
      }> = [];

      releases.forEach(release => {
        release.assets.forEach(asset => {
          allAssets.push({
            name: asset.name,
            release_tag: release.tag_name,
            downloads: asset.download_count,
            size_mb: Math.round((asset.size / (1024 * 1024)) * 100) / 100
          });
        });
      });

      const topAssets = allAssets.sort((a, b) => b.downloads - a.downloads).slice(0, 20);

      // Calculate download distribution
      const byFileType: Record<string, number> = {};
      const bySizeRange: Record<string, number> = {
        '< 1MB': 0,
        '1-10MB': 0,
        '10-100MB': 0,
        '100MB-1GB': 0,
        '> 1GB': 0
      };

      allAssets.forEach(asset => {
        const extension = asset.name.split('.').pop()?.toLowerCase() || 'unknown';
        byFileType[extension] = (byFileType[extension] || 0) + asset.downloads;

        if (asset.size_mb < 1) {
          bySizeRange['< 1MB'] += asset.downloads;
        } else if (asset.size_mb < 10) {
          bySizeRange['1-10MB'] += asset.downloads;
        } else if (asset.size_mb < 100) {
          bySizeRange['10-100MB'] += asset.downloads;
        } else if (asset.size_mb < 1024) {
          bySizeRange['100MB-1GB'] += asset.downloads;
        } else {
          bySizeRange['> 1GB'] += asset.downloads;
        }
      });

      const totalDownloads = allAssets.reduce((sum, asset) => sum + asset.downloads, 0);

      return {
        total_downloads: totalDownloads,
        downloads_by_release: downloadsByRelease,
        top_assets: topAssets,
        download_distribution: {
          by_file_type: byFileType,
          by_size_range: bySizeRange
        }
      };
    } catch (error: any) {
      throw new Error(`Failed to get download stats: ${error.message}`);
    }
  }

  /**
   * Get latest release information
   */
  async getLatestRelease(repoIdentifier: string): Promise<GitHubRelease | null> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      const response = await this.octokit.rest.repos.getLatestRelease({
        owner,
        repo
      });
      
      return response.data;
    } catch (error: any) {
      if (error.status === 404) {
        return null; // No releases found
      }
      throw new Error(`Failed to fetch latest release: ${error.message}`);
    }
  }

  /**
   * Get star history analytics inspired by star-history.com
   */
  async getStarHistory(repoIdentifier: string): Promise<StarHistoryAnalytics> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      // Get repository to get current star count and creation date
      const repository = await this.getRepository(repoIdentifier);
      const currentStars = repository.stargazers_count;
      const createdAt = new Date(repository.created_at);
      const now = new Date();
      
      // Calculate age in days
      const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get stargazers with timestamps (limited by API rate limits)
      const stargazers = await this.getStargazersWithTimestamps(owner, repo);
      
      // Build star history points
      const historyPoints: StarHistoryPoint[] = [];
      let runningStars = 0;
      
      // Group stargazers by date and build history
      const starsByDate = new Map<string, number>();
      
      stargazers.forEach(stargazer => {
        const date = stargazer.starred_at?.split('T')[0] || '';
        if (date) {
          starsByDate.set(date, (starsByDate.get(date) || 0) + 1);
        }
      });
      
      // Convert to sorted array and build cumulative history
      const sortedDates = Array.from(starsByDate.keys()).sort();
      let previousStars = 0;
      
      for (const date of sortedDates) {
        const dailyStars = starsByDate.get(date) || 0;
        runningStars += dailyStars;
        
        historyPoints.push({
          date,
          stars: runningStars,
          change: dailyStars
        });
        
        previousStars = runningStars;
      }
      
      // Calculate growth metrics
      const totalGrowth = currentStars;
      const growthRatePerDay = ageInDays > 0 ? totalGrowth / ageInDays : 0;
      const growthRatePerMonth = growthRatePerDay * 30;
      
      // Find best and worst growth days
      let bestGrowthDay: { date: string; stars_gained: number } | null = null;
      let worstGrowthDay: { date: string; stars_lost: number } | null = null;
      
      historyPoints.forEach(point => {
        if (point.change > 0 && (!bestGrowthDay || point.change > bestGrowthDay.stars_gained)) {
          bestGrowthDay = { date: point.date, stars_gained: point.change };
        }
        if (point.change < 0 && (!worstGrowthDay || point.change < worstGrowthDay.stars_lost)) {
          worstGrowthDay = { date: point.date, stars_lost: Math.abs(point.change) };
        }
      });
      
      // Calculate growth trends for different periods
      const calculateGrowthForPeriod = (days: number): number => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        
        const recentPoints = historyPoints.filter(p => p.date >= cutoffStr);
        return recentPoints.reduce((sum, point) => sum + point.change, 0);
      };
      
      const growthTrends = {
        last_7_days: calculateGrowthForPeriod(7),
        last_30_days: calculateGrowthForPeriod(30),
        last_90_days: calculateGrowthForPeriod(90),
        last_year: calculateGrowthForPeriod(365)
      };
      
      // Calculate milestones
      const milestones: Array<{
        stars: number;
        date: string;
        milestone_type: '1k' | '5k' | '10k' | '50k' | '100k' | 'custom';
      }> = [];
      
      const milestoneTargets = [
        { target: 1000, type: '1k' as const },
        { target: 5000, type: '5k' as const },
        { target: 10000, type: '10k' as const },
        { target: 50000, type: '50k' as const },
        { target: 100000, type: '100k' as const }
      ];
      
      milestoneTargets.forEach(({ target, type }) => {
        const milestonePoint = historyPoints.find(point => point.stars >= target);
        if (milestonePoint && currentStars >= target) {
          milestones.push({
            stars: target,
            date: milestonePoint.date,
            milestone_type: type
          });
        }
      });
      
      return {
        current_stars: currentStars,
        total_growth: totalGrowth,
        growth_rate_per_day: Math.round(growthRatePerDay * 100) / 100,
        growth_rate_per_month: Math.round(growthRatePerMonth * 100) / 100,
        best_growth_day: bestGrowthDay,
        worst_growth_day: worstGrowthDay,
        history_points: historyPoints,
        growth_trends: growthTrends,
        milestones: milestones
      };
    } catch (error: any) {
      throw new Error(`Failed to get star history: ${error.message}`);
    }
  }

  /**
   * Get stargazers with timestamps (limited sample due to API constraints)
   */
  private async getStargazersWithTimestamps(owner: string, repo: string): Promise<Array<{ starred_at: string | null }>> {
    try {
      const stargazers: Array<{ starred_at: string | null }> = [];
      let page = 1;
      const maxPages = 10; // Limit to avoid rate limits
      
      while (page <= maxPages) {
        const response = await this.octokit.rest.activity.listStargazersForRepo({
          owner,
          repo,
          per_page: 100,
          page,
          headers: {
            'Accept': 'application/vnd.github.star+json' // Required for timestamps
          }
        });
        
        if (response.data.length === 0) break;
        
        // Add starred_at timestamps
        stargazers.push(...response.data.map((item: any) => ({
          starred_at: item.starred_at || null
        })));
        
        if (response.data.length < 100) break;
        page++;
      }
      
      return stargazers;
    } catch (error: any) {
      // Fallback: return empty array if API doesn't support timestamps
      console.error('Star timestamp API not available:', error.message);
      return [];
    }
  }

  /**
   * Get simplified star history using star-history.com approach
   */
  async getSimpleStarHistory(repoIdentifier: string): Promise<{
    current_stars: number;
    estimated_daily_growth: number;
    repository_age_days: number;
    star_history_url: string;
  }> {
    try {
      const repository = await this.getRepository(repoIdentifier);
      const createdAt = new Date(repository.created_at);
      const now = new Date();
      const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedDailyGrowth = ageInDays > 0 ? repository.stargazers_count / ageInDays : 0;
      
      // Generate star-history.com URL
      const starHistoryUrl = `https://star-history.com/#${repository.full_name}&Date`;
      
      return {
        current_stars: repository.stargazers_count,
        estimated_daily_growth: Math.round(estimatedDailyGrowth * 100) / 100,
        repository_age_days: ageInDays,
        star_history_url: starHistoryUrl
      };
    } catch (error: any) {
      throw new Error(`Failed to get simple star history: ${error.message}`);
    }
  }

  /**
   * Get influencer developers who have starred the repository
   */
  async getInfluencerStargazers(repoIdentifier: string, limit: number = 100): Promise<InfluencerAnalytics> {
    const { owner, repo } = this.parseRepoIdentifier(repoIdentifier);
    
    try {
      console.error(`Analyzing influencer stargazers for ${owner}/${repo}...`);
      
      // Get stargazers with timestamps
      const stargazersData = await this.getDetailedStargazers(owner, repo, limit);
      
      console.error(`Found ${stargazersData.length} stargazers, fetching detailed profiles...`);
      
      // Fetch detailed user information for each stargazer
      const influencers: InfluencerDeveloper[] = [];
      const batchSize = 10; // Process in batches to avoid rate limits
      
      for (let i = 0; i < stargazersData.length; i += batchSize) {
        const batch = stargazersData.slice(i, i + batchSize);
        const batchPromises = batch.map(async (stargazer) => {
          try {
            const userResponse = await this.octokit.rest.users.getByUsername({
              username: stargazer.login
            });
            
            const user = userResponse.data;
            
            // Calculate influence score based on followers, repos, and account age
            const accountAge = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365));
            const influenceScore = this.calculateInfluenceScore(user.followers, user.public_repos, accountAge);
            
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
              influence_score: influenceScore
            };
          } catch (error: any) {
            console.error(`Failed to fetch user ${stargazer.login}:`, error.message);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        influencers.push(...batchResults.filter((user): user is NonNullable<typeof user> => user !== null));
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < stargazersData.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.error(`Successfully analyzed ${influencers.length} influencer profiles`);
      
      // Sort by influence score (combination of followers and other factors)
      influencers.sort((a, b) => b.influence_score - a.influence_score);
      
      // Calculate analytics
      const totalFollowers = influencers.reduce((sum, user) => sum + user.followers, 0);
      const averageFollowers = influencers.length > 0 ? totalFollowers / influencers.length : 0;
      
      // Categorize influencers by follower count
      const influenceDistribution = {
        mega_influencers: influencers.filter(u => u.followers >= 10000).length,
        macro_influencers: influencers.filter(u => u.followers >= 1000 && u.followers < 10000).length,
        micro_influencers: influencers.filter(u => u.followers >= 100 && u.followers < 1000).length,
        regular_users: influencers.filter(u => u.followers < 100).length
      };
      
      // Geographic distribution
      const geographicDistribution: Record<string, number> = {};
      influencers.forEach(user => {
        if (user.location) {
          const location = user.location.trim();
          geographicDistribution[location] = (geographicDistribution[location] || 0) + 1;
        }
      });
      
      // Company distribution
      const companyDistribution: Record<string, number> = {};
      influencers.forEach(user => {
        if (user.company) {
          const company = user.company.trim().replace('@', '');
          companyDistribution[company] = (companyDistribution[company] || 0) + 1;
        }
      });
      
      // Calculate metrics
      const sortedByFollowers = [...influencers].sort((a, b) => b.followers - a.followers);
      const medianIndex = Math.floor(sortedByFollowers.length / 2);
      const medianFollowers = sortedByFollowers.length > 0 ? sortedByFollowers[medianIndex].followers : 0;
      
      const top10PercentCount = Math.ceil(sortedByFollowers.length * 0.1);
      const top10PercentFollowers = sortedByFollowers.slice(0, top10PercentCount).reduce((sum, user) => sum + user.followers, 0);
      const influenceConcentration = totalFollowers > 0 ? (top10PercentFollowers / totalFollowers) * 100 : 0;
      
      // Identify notable stargazers
      const notableStargazers = this.identifyNotableStargazers(influencers);
      
      return {
        total_stargazers_analyzed: influencers.length,
        total_followers_reached: totalFollowers,
        average_followers_per_stargazer: Math.round(averageFollowers),
        top_influencers: influencers.slice(0, 50), // Top 50 influencers
        influence_distribution: influenceDistribution,
        geographic_distribution: geographicDistribution,
        company_distribution: companyDistribution,
        metrics: {
          total_potential_reach: totalFollowers,
          median_followers: medianFollowers,
          top_10_percent_followers: top10PercentFollowers,
          influence_concentration: Math.round(influenceConcentration * 100) / 100
        },
        notable_stargazers: notableStargazers
      };
    } catch (error: any) {
      throw new Error(`Failed to get influencer stargazers: ${error.message}`);
    }
  }

  /**
   * Get detailed stargazers with timestamps
   */
  private async getDetailedStargazers(owner: string, repo: string, limit: number): Promise<Array<{ login: string; starred_at: string | null }>> {
    try {
      const stargazers: Array<{ login: string; starred_at: string | null }> = [];
      let page = 1;
      const perPage = Math.min(100, limit);
      
      while (stargazers.length < limit) {
        const response = await this.octokit.rest.activity.listStargazersForRepo({
          owner,
          repo,
          per_page: perPage,
          page,
          headers: {
            'Accept': 'application/vnd.github.star+json' // Required for timestamps
          }
        });
        
        if (response.data.length === 0) break;
        
        const batchStargazers = response.data.map((item: any) => ({
          login: item.user?.login || '',
          starred_at: item.starred_at || null
        })).filter(s => s.login);
        
        stargazers.push(...batchStargazers);
        
        if (response.data.length < perPage || stargazers.length >= limit) break;
        page++;
      }
      
      return stargazers.slice(0, limit);
    } catch (error: any) {
      // Fallback to regular stargazers API without timestamps
      console.error('Star timestamp API not available, using fallback:', error.message);
      return this.getFallbackStargazers(owner, repo, limit);
    }
  }

  /**
   * Fallback method to get stargazers without timestamps
   */
  private async getFallbackStargazers(owner: string, repo: string, limit: number): Promise<Array<{ login: string; starred_at: string | null }>> {
    const stargazers: Array<{ login: string; starred_at: string | null }> = [];
    let page = 1;
    const perPage = Math.min(100, limit);
    
    while (stargazers.length < limit) {
      const response = await this.octokit.rest.activity.listStargazersForRepo({
        owner,
        repo,
        per_page: perPage,
        page
      });
      
      if (response.data.length === 0) break;
      
      const batchStargazers = response.data.map((user: any) => ({
        login: user.login,
        starred_at: null
      }));
      
      stargazers.push(...batchStargazers);
      
      if (response.data.length < perPage || stargazers.length >= limit) break;
      page++;
    }
    
    return stargazers.slice(0, limit);
  }

  /**
   * Calculate influence score based on multiple factors
   */
  private calculateInfluenceScore(followers: number, repos: number, accountAgeYears: number): number {
    // Weight factors
    const followerWeight = 0.6;
    const repoWeight = 0.2;
    const ageWeight = 0.2;
    
    // Normalize values
    const normalizedFollowers = Math.log10(followers + 1) * 10; // Log scale for followers
    const normalizedRepos = Math.min(repos / 10, 10); // Cap at reasonable repo count
    const normalizedAge = Math.min(accountAgeYears, 10); // Cap at 10 years
    
    return (normalizedFollowers * followerWeight) + 
           (normalizedRepos * repoWeight) + 
           (normalizedAge * ageWeight);
  }

  /**
   * Identify notable stargazers based on various criteria
   */
  private identifyNotableStargazers(influencers: InfluencerDeveloper[]): Array<{
    login: string;
    followers: number;
    company: string | null;
    reason: string;
  }> {
    const notable: Array<{
      login: string;
      followers: number;
      company: string | null;
      reason: string;
    }> = [];
    
    // High follower count
    influencers.filter(u => u.followers >= 10000).slice(0, 10).forEach(user => {
      notable.push({
        login: user.login,
        followers: user.followers,
        company: user.company,
        reason: `Mega influencer with ${user.followers.toLocaleString()} followers`
      });
    });
    
    // Notable companies
    const notableCompanies = ['GitHub', 'Microsoft', 'Google', 'Meta', 'Apple', 'Netflix', 'Amazon', 'Vercel', 'Stripe'];
    influencers.filter(u => u.company && notableCompanies.some(company => 
      u.company!.toLowerCase().includes(company.toLowerCase())
    )).slice(0, 5).forEach(user => {
      notable.push({
        login: user.login,
        followers: user.followers,
        company: user.company,
        reason: `Works at notable company: ${user.company}`
      });
    });
    
    // High influence score
    influencers.slice(0, 5).forEach(user => {
      if (!notable.some(n => n.login === user.login)) {
        notable.push({
          login: user.login,
          followers: user.followers,
          company: user.company,
          reason: `High influence score (${Math.round(user.influence_score)})`
        });
      }
    });
    
    return notable.slice(0, 20); // Limit to top 20 notable stargazers
  }
}