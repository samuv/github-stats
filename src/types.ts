import type { Endpoints } from '@octokit/types';

// Tool argument interfaces
export interface RepositoryArgs {
  repository: string;
}

export interface LimitArgs extends RepositoryArgs {
  limit?: number;
}

export interface SearchArgs {
  query: string;
  limit?: number;
}

export interface TrafficArgs extends RepositoryArgs {
  include_analysis?: boolean;
}

// Use Octokit's native types instead of custom ones
export type GitHubRepository = Endpoints['GET /repos/{owner}/{repo}']['response']['data'];
export type GitHubSearchRepository = Endpoints['GET /search/repositories']['response']['data']['items'][0];
export type GitHubRelease = Endpoints['GET /repos/{owner}/{repo}/releases/{release_id}']['response']['data'];
export type GitHubIssue = Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}']['response']['data'];
export type GitHubPullRequest = Endpoints['GET /repos/{owner}/{repo}/pulls']['response']['data'][0];
export type GitHubContributor = Endpoints['GET /repos/{owner}/{repo}/contributors']['response']['data'][0];
// Commit activity can return either an array of activity data or an empty object
export type GitHubCommitActivityResponse = Endpoints['GET /repos/{owner}/{repo}/stats/commit_activity']['response']['data'];
export type GitHubCommitActivity = { total: number; week: number; days: number[]; };
export type GitHubLanguageStats = Endpoints['GET /repos/{owner}/{repo}/languages']['response']['data'];
export type GitHubTrafficReferrer = Endpoints['GET /repos/{owner}/{repo}/traffic/popular/referrers']['response']['data'][0];



export interface ReleaseAnalytics {
  total_releases: number;
  total_downloads: number;
  total_assets: number;
  average_downloads_per_release: number;
  most_downloaded_release: {
    tag_name: string;
    name: string | null;
    downloads: number;
    published_at: string | null;
  } | null;
  latest_release: GitHubRelease | null;
  release_frequency: {
    days_between_releases: number;
    releases_per_month: number;
    releases_per_year: number;
  };
  download_trends: Array<{
    tag_name: string;
    total_downloads: number;
    asset_breakdown: Array<{
      name: string;
      downloads: number;
      size_mb: number;
    }>;
  }>;
  asset_types: Record<string, {
    count: number;
    total_downloads: number;
    total_size_mb: number;
  }>;
  prerelease_stats: {
    total_prereleases: number;
    percentage_prereleases: number;
  };
}

export interface DownloadStats {
  total_downloads: number;
  downloads_by_release: Array<{
    tag_name: string;
    name: string | null;
    published_at: string | null;
    total_downloads: number;
    assets: Array<{
      name: string;
      downloads: number;
      size_mb: number;
      content_type: string;
    }>;
  }>;
  top_assets: Array<{
    name: string;
    release_tag: string;
    downloads: number;
    size_mb: number;
  }>;
  download_distribution: {
    by_file_type: Record<string, number>;
    by_size_range: Record<string, number>;
  };
}

export interface StarHistoryPoint {
  date: string;
  stars: number;
  change: number; // stars gained/lost since previous point
}

export interface StarHistoryAnalytics {
  current_stars: number;
  total_growth: number;
  growth_rate_per_day: number;
  growth_rate_per_month: number;
  best_growth_day: {
    date: string;
    stars_gained: number;
  } | null;
  worst_growth_day: {
    date: string;
    stars_lost: number;
  } | null;
  history_points: StarHistoryPoint[];
  growth_trends: {
    last_7_days: number;
    last_30_days: number;
    last_90_days: number;
    last_year: number;
  };
  milestones: Array<{
    stars: number;
    date: string;
    milestone_type: '1k' | '5k' | '10k' | '50k' | '100k' | 'custom';
  }>;
}

export interface InfluencerDeveloper {
  login: string;
  id: number;
  name: string | null;
  avatar_url: string;
  html_url: string;
  followers: number;
  following: number;
  public_repos: number;
  public_gists: number;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  created_at: string;
  starred_at: string | null;
  influence_score: number; // Calculated metric based on followers and activity
}

export interface InfluencerAnalytics {
  total_stargazers_analyzed: number;
  total_followers_reached: number;
  average_followers_per_stargazer: number;
  top_influencers: InfluencerDeveloper[];
  influence_distribution: {
    mega_influencers: number; // 10k+ followers
    macro_influencers: number; // 1k-10k followers
    micro_influencers: number; // 100-1k followers
    regular_users: number; // <100 followers
  };
  geographic_distribution: Record<string, number>; // by location
  company_distribution: Record<string, number>; // by company
  metrics: {
    total_potential_reach: number; // Sum of all followers
    median_followers: number;
    top_10_percent_followers: number;
    influence_concentration: number; // What % of total reach comes from top 10%
  };
  notable_stargazers: Array<{
    login: string;
    followers: number;
    company: string | null;
    reason: string; // Why they're notable (high followers, famous company, etc.)
  }>;
}



export interface GitHubStats {
  repository: GitHubRepository;
  languages: GitHubLanguageStats;
  contributors: GitHubContributor[];
  releases: GitHubRelease[];
  commitActivity: GitHubCommitActivity[];
  openIssues: GitHubIssue[];
  openPullRequests: GitHubPullRequest[];
  releaseAnalytics: ReleaseAnalytics;
  downloadStats: DownloadStats;
  starHistory: StarHistoryAnalytics;
}

// Union type for all possible handler response data
export type HandlerResponseData = 
  | GitHubRepository
  | GitHubRelease
  | GitHubRelease[]
  | GitHubContributor[]
  | GitHubIssue[]
  | GitHubPullRequest[]
  | GitHubCommitActivity[]
  | GitHubLanguageStats
  | GitHubTrafficReferrer[]
  | GitHubSearchRepository[]
  | StarHistoryAnalytics
  | InfluencerAnalytics
  | ReleaseAnalytics
  | DownloadStats
  | GitHubStats
  | { total_bytes: number; languages: any[] }
  | { total_releases: number; releases: any[] }
  | { total_contributors: number; contributors: any[] }
  | { total_stargazers_analyzed: number; [key: string]: any }
  | { referrers: GitHubTrafficReferrer[]; analytics?: any; [key: string]: any }
  | { error: string; [key: string]: any }
  | { truncation_info?: any; [key: string]: any };