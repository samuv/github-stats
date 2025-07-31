/**
 * GitHub API client setup and configuration
 */
import { Octokit } from "@octokit/rest";
import { createRateLimitHook } from "../utils/rate-limit.js";

export interface GitHubConfig {
	token?: string;
	userAgent?: string;
	enableRateLimitHandling?: boolean;
}

export const createClient = (config: GitHubConfig = {}): Octokit => {
	const octokit = new Octokit({
		auth: config.token,
		userAgent: config.userAgent || "github-stats-mcp/1.0.0",
	});

	// Add global rate limit handling by default
	if (config.enableRateLimitHandling !== false) {
		const rateLimitHook = createRateLimitHook();

		// Add hooks for automatic rate limit handling
		octokit.hook.before("request", rateLimitHook.before);
		octokit.hook.after("request", rateLimitHook.after);
		octokit.hook.error("request", rateLimitHook.error);

		console.error(
			"✅ Global rate limit handling enabled for GitHub API client",
		);
	}

	return octokit;
};

export const defaultClient: Octokit = createClient({
	token: process.env.GITHUB_TOKEN,
});
