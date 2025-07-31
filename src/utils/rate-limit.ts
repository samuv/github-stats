/**
 * Functional rate limit management for GitHub API calls
 * Implements the rate limit checking logic from GitHub's documentation:
 * https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
 */
import type {
	RequestError,
	RequestOptions,
	ResponseHeaders,
} from "@octokit/types";
import type {
	RateLimitError,
	RateLimitState,
	RateLimitStatus,
} from "../types.js";

// Octokit hook types - compatible with actual Octokit types
interface OctokitResponse {
	headers: ResponseHeaders;
	status: number;
	data?: unknown;
}

// Immutable state container
let currentRateLimitState: Readonly<RateLimitState> | null = null;
let _lastUpdated = 0;

/**
 * Parse rate limit headers from GitHub API response
 */
export const parseRateLimitHeaders = (
	headers: ResponseHeaders | Record<string, string>,
): RateLimitStatus | null => {
	const limit = headers["x-ratelimit-limit"];
	const remaining = headers["x-ratelimit-remaining"];
	const used = headers["x-ratelimit-used"];
	const reset = headers["x-ratelimit-reset"];
	const resource = headers["x-ratelimit-resource"];

	// Convert header values to strings and validate
	const limitStr = String(limit || "");
	const remainingStr = String(remaining || "");
	const usedStr = String(used || "");
	const resetStr = String(reset || "");
	const resourceStr = String(resource || "");

	if (!limitStr || !remainingStr || !usedStr || !resetStr || !resourceStr) {
		return null;
	}

	return Object.freeze({
		limit: parseInt(limitStr, 10),
		remaining: parseInt(remainingStr, 10),
		used: parseInt(usedStr, 10),
		reset: parseInt(resetStr, 10),
		resource: resourceStr,
	});
};

/**
 * Create a new rate limit state with updated resource information
 */
const updateRateLimitState = (
	currentState: RateLimitState | null,
	newStatus: RateLimitStatus,
): RateLimitState => {
	const baseState = currentState || { core: newStatus };

	return Object.freeze({
		...baseState,
		[newStatus.resource]: Object.freeze(newStatus),
	});
};

/**
 * Update rate limit state from response headers (pure function)
 */
export const updateFromHeaders = (
	headers: ResponseHeaders | Record<string, string>,
): RateLimitState | null => {
	const rateLimitStatus = parseRateLimitHeaders(headers);
	if (!rateLimitStatus) {
		return currentRateLimitState;
	}

	// Create new immutable state
	const newState = updateRateLimitState(currentRateLimitState, rateLimitStatus);

	// Update global state (only mutation point, isolated)
	currentRateLimitState = newState;
	_lastUpdated = Date.now();

	// Log rate limit status
	console.error(
		`Rate limit update - ${rateLimitStatus.resource}: ${rateLimitStatus.remaining}/${rateLimitStatus.limit} remaining, resets at ${new Date(rateLimitStatus.reset * 1000).toISOString()}`,
	);

	// Warn if rate limit is getting low
	if (rateLimitStatus.remaining < 100) {
		console.error(
			`⚠️  WARNING: Rate limit is getting low! Only ${rateLimitStatus.remaining} requests remaining for ${rateLimitStatus.resource}`,
		);
	}

	return newState;
};

/**
 * Check if we're currently rate limited for a resource
 */
export const isRateLimited = (resource = "core"): boolean => {
	if (!currentRateLimitState) {
		return false;
	}

	const rateLimitStatus =
		currentRateLimitState[resource as keyof RateLimitState];
	if (!rateLimitStatus) {
		return false;
	}

	// Check if we have remaining requests
	if (rateLimitStatus.remaining <= 0) {
		const resetTime = rateLimitStatus.reset * 1000;
		const now = Date.now();

		// If reset time has passed, we're no longer rate limited
		return now < resetTime;
	}

	return false;
};

/**
 * Get time until rate limit reset (in milliseconds)
 */
export const getTimeUntilReset = (resource = "core"): number => {
	if (!currentRateLimitState) {
		return 0;
	}

	const rateLimitStatus =
		currentRateLimitState[resource as keyof RateLimitState];
	if (!rateLimitStatus) {
		return 0;
	}

	const resetTime = rateLimitStatus.reset * 1000;
	const now = Date.now();

	return Math.max(0, resetTime - now);
};

/**
 * Get current rate limit state (immutable copy)
 */
export const getRateLimitState = (): Readonly<RateLimitState> | null => {
	return currentRateLimitState;
};

/**
 * Create a rate limit error from response
 */
export const createRateLimitError = (
	response: {
		status: number;
		headers: ResponseHeaders | Record<string, string>;
	},
	message: string,
): RateLimitError => {
	const error = new Error(message) as RateLimitError;
	error.status = response.status;

	// Check for retry-after header (secondary rate limits)
	const retryAfter = response.headers["retry-after"];
	if (retryAfter) {
		error.retryAfter = parseInt(String(retryAfter), 10);
	}

	// Check for reset time (primary rate limits)
	const reset = response.headers["x-ratelimit-reset"];
	if (reset) {
		error.resetTime = parseInt(String(reset), 10);
	}

	return error;
};

/**
 * Check if we should block a request due to rate limits
 */
export const shouldBlockRequest = (
	resource = "core",
): Readonly<{
	blocked: boolean;
	waitTime?: number;
	reason?: string;
}> => {
	if (!isRateLimited(resource)) {
		return Object.freeze({ blocked: false });
	}

	const waitTime = getTimeUntilReset(resource);
	const resetDate = new Date(Date.now() + waitTime);

	return Object.freeze({
		blocked: true,
		waitTime: Math.ceil(waitTime / 1000), // Convert to seconds
		reason: `Rate limit exceeded for ${resource}. Reset at ${resetDate.toISOString()}`,
	});
};

/**
 * Wait until rate limit reset if needed
 */
export const waitForRateLimit = async (resource = "core"): Promise<void> => {
	const blockStatus = shouldBlockRequest(resource);
	if (!blockStatus.blocked || !blockStatus.waitTime) {
		return;
	}

	console.error(
		`Rate limit hit. Waiting ${blockStatus.waitTime} seconds until reset...`,
	);
	console.error(blockStatus.reason);

	// Wait for the rate limit to reset
	const waitTimeMs = (blockStatus.waitTime || 0) * 1000;
	await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
};

/**
 * Create an Octokit request hook that handles rate limits globally
 */
export const createRateLimitHook = () => {
	return Object.freeze({
		before: async (_options: RequestOptions) => {
			// Check if we should block this request
			const blockStatus = shouldBlockRequest();
			if (blockStatus.blocked) {
				if (blockStatus.waitTime && blockStatus.waitTime > 0) {
					await waitForRateLimit();
				} else {
					throw createRateLimitError(
						{ status: 429, headers: {} },
						blockStatus.reason || "Rate limit exceeded",
					);
				}
			}
		},

		after: async (response: OctokitResponse) => {
			// Update rate limit state from response headers
			updateFromHeaders(response.headers);
		},

		error: async (error: Error | RequestError) => {
			// Type guard for objects with status property
			const hasStatus = (err: unknown): err is { status: number } =>
				typeof err === "object" && err !== null && "status" in err;

			// Type guard for objects with message property
			const hasMessage = (err: unknown): err is { message: string } =>
				typeof err === "object" && err !== null && "message" in err;

			if (hasStatus(error)) {
				const status = error.status;

				if (status === 403 || status === 429) {
					// Try to get headers from error object
					const errorWithHeaders = error as unknown as {
						response?: { headers?: ResponseHeaders };
						headers?: ResponseHeaders;
					};
					const headers =
						errorWithHeaders.response?.headers ||
						errorWithHeaders.headers ||
						{};
					updateFromHeaders(headers);

					// Get error message safely
					const errorMessage = hasMessage(error)
						? error.message
						: error.toString();
					const rateLimitError = createRateLimitError(
						{ status, headers },
						`GitHub API rate limit exceeded: ${errorMessage}`,
					);

					throw rateLimitError;
				}
			}

			// Re-throw non-rate-limit errors
			throw error;
		},
	});
};
