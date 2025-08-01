# GitHub Stats MCP Server

A Model Context Protocol (MCP) server that provides comprehensive GitHub repository statistics and information. This server allows AI assistants to retrieve detailed data about GitHub repositories including stars, forks, contributors, releases, commit activity, and more.

## Features

This MCP server provides comprehensive GitHub repository analytics with a focus on release and download statistics. All data is fetched directly from the GitHub API, ensuring accuracy and completeness.

### Key Features:
- **Comprehensive Release Analytics**: Track download trends, release frequency, and asset performance
- **Detailed Download Statistics**: Analyze which releases and assets are most popular
- **Asset Type Analysis**: Understand download patterns by file type and size
- **Release Trend Analysis**: Monitor release cadence and patterns over time
- **Star History Analytics**: Track repository popularity growth inspired by [star-history.com](https://star-history.com/)
- **Growth Trend Analysis**: Monitor star growth rates, milestones, and best/worst growth days
- **Influencer Analysis**: Identify influential developers who have starred your repository
- **Developer Insights**: Analyze follower counts, companies, and geographic distribution of stargazers
- **Complete Data Coverage**: Fetch all releases, not just recent ones
- **Rich Metadata**: Include file sizes, content types, and timestamps
- **Performance Insights**: Calculate averages, totals, and distribution metrics

This MCP server provides the following tools:

### Basic Repository Information
- **get_repository_info**: Get basic repository information (stars, forks, description, etc.)
- **get_language_stats**: Get programming language breakdown with percentages
- **get_contributors**: Get list of repository contributors
- **get_commit_activity**: Get commit activity statistics for the past year
- **get_open_issues**: Get currently open issues
- **get_open_pull_requests**: Get currently open pull requests
- **search_repositories**: Search for repositories on GitHub

### Release & Download Analytics
- **get_release_analytics**: Get comprehensive release analytics including download stats, frequency, and trends
- **get_download_stats**: Get detailed download statistics for all releases and assets
- **get_all_releases**: Get all releases for a repository (not limited to recent ones)
- **get_latest_release**: Get the latest release information with full details
- **get_releases**: Get recent repository releases (limited)

### Star History Analytics (inspired by [star-history.com](https://star-history.com/))
- **get_star_history**: Get comprehensive star history analytics with growth trends and milestones
- **get_simple_star_history**: Get simplified star history with [star-history.com](https://star-history.com/) visualization URL

### Influencer Analytics
- **get_influencer_stargazers**: Analyze influential developers who starred the repository based on follower count and activity

### Comprehensive Analysis
- **get_comprehensive_stats**: Get all available statistics including release analytics in one call

## Docker Usage

This MCP server is designed to be used with Docker. The Docker image is automatically built and published to GitHub Container Registry (GHCR) via GitHub Actions.

### Automated Publishing

The Docker image is automatically built and published when:
- A new release is published on GitHub (e.g., `v1.0.0`)
- Manually triggered from the GitHub Actions tab
- Pull requests are created (builds only, doesn't publish)

### Creating a Release

To publish a new Docker image:

1. Go to your GitHub repository
2. Click on "Releases" in the right sidebar
3. Click "Create a new release"
4. Choose or create a new tag (e.g., `v1.0.0`)
5. Fill in the release title and description
6. Click "Publish release"

This will automatically trigger the Docker build and publish the image with proper version tags.

## Development

### Code Quality & CI

This project uses [Biome](https://biomejs.dev/) for linting and formatting, with automated CI checks on every push and pull request.

**Available Scripts:**
```bash
# Format code
pnpm format

# Lint and fix issues
pnpm lint

# Check code quality (local development)
pnpm check

# Check code quality (CI - no auto-fix)
pnpm ci

# Build TypeScript
pnpm build
```

**GitHub Actions:**
- **Docker Workflow**: Automatically runs `pnpm ci`, `pnpm build`, and Docker build on PRs and releases
  - On PRs: Tests code quality and build (doesn't publish)
  - On releases: Tests, builds, and publishes to GitHub Container Registry

### Pull and Run

```bash
# Pull the latest image from GitHub Container Registry
docker pull ghcr.io/[your-username]/github-stats-mcp:latest

# Run the MCP server
docker run -e GITHUB_TOKEN=your_token_here ghcr.io/[your-username]/github-stats-mcp:latest

# Or run a specific version
docker pull ghcr.io/[your-username]/github-stats-mcp:v1.0.0
docker run -e GITHUB_TOKEN=your_token_here ghcr.io/[your-username]/github-stats-mcp:v1.0.0
```

### Local Development

For local development, you can build the image yourself:

```bash
# Build locally using the provided script
pnpm run docker:build

# Or build manually
docker build -t github-stats-mcp:latest .
```

### Environment Variables

- `GITHUB_TOKEN` (optional but recommended): GitHub personal access token for higher rate limits and access to private repositories

To create a GitHub token:
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with appropriate permissions
3. Pass it as an environment variable when running the container

## API Reference

### get_repository_info
Get basic information about a GitHub repository.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

**Example:**
```json
{
  "repository": "microsoft/vscode"
}
```

### get_language_stats
Get programming language statistics for a repository.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

### get_contributors
Get list of contributors to a repository.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL
- `limit` (number, optional): Maximum number of contributors to return (default: 30)

### get_releases
Get list of releases for a repository.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL
- `limit` (number, optional): Maximum number of releases to return (default: 10)

### get_commit_activity
Get commit activity statistics for a repository (weekly activity for the past year).

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

### get_open_issues
Get list of open issues for a repository.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL
- `limit` (number, optional): Maximum number of issues to return (default: 30)

### get_open_pull_requests
Get list of open pull requests for a repository.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL
- `limit` (number, optional): Maximum number of pull requests to return (default: 30)

### get_comprehensive_stats
Get comprehensive statistics for a repository including all available data.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

### search_repositories
Search for repositories on GitHub.

**Parameters:**
- `query` (string, required): Search query (e.g., "machine learning python", "user:microsoft", "topic:react")
- `limit` (number, optional): Maximum number of repositories to return (default: 10)

### get_release_analytics
Get comprehensive release analytics including download stats, release frequency, and asset analysis.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

**Returns:**
- Total releases, downloads, and assets
- Average downloads per release
- Most downloaded release
- Release frequency statistics
- Download trends by release
- Asset type breakdown
- Prerelease statistics

### get_download_stats
Get detailed download statistics for all releases and assets.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

**Returns:**
- Downloads by release with asset breakdown
- Top assets across all releases
- Download distribution by file type and size
- Comprehensive download analytics

### get_all_releases
Get all releases for a repository (not limited to recent ones).

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

**Returns:**
- Complete list of all releases
- Full asset information including download counts
- Release metadata and timestamps

### get_latest_release
Get the latest release information with full details.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

**Returns:**
- Latest release with complete asset information
- Download counts and file details
- Release notes and metadata

### get_star_history
Get comprehensive star history analytics inspired by [star-history.com](https://star-history.com/) with growth trends and milestones.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

**Returns:**
- Current star count and total growth
- Growth rates (daily/monthly)
- Best and worst growth days
- Growth trends for different periods (7/30/90 days, 1 year)
- Star milestones (1k, 5k, 10k, 50k, 100k)
- Historical star data points

### get_simple_star_history
Get simplified star history metrics with [star-history.com](https://star-history.com/) URL for visualization.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL

**Returns:**
- Current star count
- Estimated daily growth rate
- Repository age in days
- Direct link to [star-history.com](https://star-history.com/) visualization

### get_influencer_stargazers
Analyze influential developers who have starred the repository based on follower count and activity.

**Parameters:**
- `repository` (string, required): Repository identifier (owner/repo) or full GitHub URL
- `limit` (number, optional): Maximum number of stargazers to analyze (default: 100, max recommended: 200)

**Returns:**
- **Top influencers**: List of most influential stargazers with detailed profiles
- **Influence distribution**: Breakdown by follower categories (mega/macro/micro influencers)
- **Geographic distribution**: Where influential stargazers are located
- **Company distribution**: Notable companies represented
- **Metrics**: Total reach, median followers, influence concentration
- **Notable stargazers**: Developers from famous companies or with high influence scores

**Note:** This tool makes many API calls and may take time for large repositories. Use a GitHub token for higher rate limits.

## Rate Limits

- **Without GitHub token**: 60 requests per hour
- **With GitHub token**: 5,000 requests per hour

It's highly recommended to use a GitHub token for any production usage.

## Repository Identifier Formats

The server accepts repositories in the following formats:

- `owner/repo` (e.g., "microsoft/vscode")
- Full GitHub URL (e.g., "https://github.com/microsoft/vscode")

## Error Handling

The server includes comprehensive error handling for common scenarios:

- Repository not found (404 errors)
- Rate limit exceeded
- Invalid repository identifiers
- Network connectivity issues

All errors are returned in a user-friendly format with descriptive messages.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions, please open an issue on the GitHub repository.