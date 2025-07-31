/**
 * General utility helpers
 */

// Import the response data type
import type { HandlerResponseData } from "../types.js";

// Array operations
export const chunk = <T>(array: T[], size: number): T[][] => {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
};

export const groupBy = <T, K extends string | number | symbol>(
	array: T[],
	keyFn: (item: T) => K,
): Record<K, T[]> => {
	return array.reduce(
		(groups, item) => {
			const key = keyFn(item);
			if (!groups[key]) {
				groups[key] = [];
			}
			groups[key].push(item);
			return groups;
		},
		{} as Record<K, T[]>,
	);
};

export const sortByField =
	<T>(field: keyof T, desc = false) =>
	(array: T[]): T[] => {
		return [...array].sort((a, b) => {
			const aVal = a[field];
			const bVal = b[field];

			// Handle numeric comparisons
			if (typeof aVal === "number" && typeof bVal === "number") {
				return desc ? bVal - aVal : aVal - bVal;
			}

			// Handle string comparisons
			if (typeof aVal === "string" && typeof bVal === "string") {
				return desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
			}

			// Fallback comparison
			return desc
				? bVal > aVal
					? 1
					: bVal < aVal
						? -1
						: 0
				: aVal > bVal
					? 1
					: aVal < bVal
						? -1
						: 0;
		});
	};

// Async operations
export const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const processInBatches = async <T, U>(
	items: T[],
	processor: (item: T) => Promise<U | null>,
	batchSize: number,
	delayMs: number = 0,
): Promise<U[]> => {
	const results: U[] = [];
	const batches = chunk(items, batchSize);

	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i];
		const batchResults = await Promise.all(batch.map(processor));
		results.push(
			...batchResults.filter(
				(result): result is NonNullable<typeof result> => result !== null,
			),
		);

		if (i < batches.length - 1 && delayMs > 0) {
			await delay(delayMs);
		}
	}

	return results;
};

// Error handling
export const withErrorHandling =
	<T extends unknown[], R>(
		fn: (...args: T) => Promise<R>,
		errorMessage: string,
	) =>
	async (...args: T): Promise<R> => {
		try {
			return await fn(...args);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`${errorMessage}: ${message}`);
		}
	};

// Retry logic for operations that may need time to complete
export const withRetry = async <T, U extends T>(
	operation: () => Promise<T>,
	isValidResult: (result: T) => result is U,
	maxRetries: number = 10,
	delayMs: number = 1000,
): Promise<U> => {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const result = await operation();

		if (isValidResult(result)) {
			return result; // TypeScript knows this is U due to type guard
		}

		// Don't delay after the last attempt
		if (attempt < maxRetries - 1) {
			await delay(delayMs);
		}
	}

	// Make one final attempt and return result (may still be invalid)
	const finalResult = await operation();
	if (isValidResult(finalResult)) {
		return finalResult;
	}

	// If we still don't have valid data after all retries, throw an error
	throw new Error(`Failed to get valid result after ${maxRetries} retries`);
};

// Math operations
export const sum = (numbers: number[]): number =>
	numbers.reduce((acc, num) => acc + num, 0);

export const average = (numbers: number[]): number =>
	numbers.length > 0 ? sum(numbers) / numbers.length : 0;

export const median = (numbers: number[]): number => {
	if (numbers.length === 0) return 0;
	const sorted = [...numbers].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
};

// String operations
export const parseRepoIdentifier = (
	identifier: string,
): { owner: string; repo: string } => {
	if (identifier.startsWith("http")) {
		const url = new URL(identifier);
		const pathParts = url.pathname.split("/").filter((part) => part.length > 0);
		if (pathParts.length >= 2) {
			return { owner: pathParts[0], repo: pathParts[1] };
		}
		throw new Error("Invalid GitHub URL format");
	}

	const parts = identifier.split("/");
	if (parts.length === 2) {
		return { owner: parts[0], repo: parts[1] };
	}

	throw new Error(
		'Repository identifier must be in format "owner/repo" or a full GitHub URL',
	);
};

// Date operations
export const calculateDaysBetween = (date1: string, date2: string): number => {
	const d1 = new Date(date1);
	const d2 = new Date(date2);
	return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};

export const calculateAgeInDays = (createdAt: string): number => {
	return calculateDaysBetween(createdAt, new Date().toISOString());
};

// Token limit handler - roughly 4 chars per token, with safety margin
const DEFAULT_MAX_RESPONSE_CHARS = 90000; // ~22.5K tokens with safety margin

// Type guard to check if data has a specific array field
const hasArrayField = (
	data: HandlerResponseData,
	fieldName: string,
): data is HandlerResponseData & Record<string, unknown[]> => {
	return (
		typeof data === "object" &&
		data !== null &&
		fieldName in data &&
		Array.isArray((data as Record<string, unknown>)[fieldName])
	);
};

// Dynamic token limit - can be overridden per request
export const truncateResponse = (
	data: HandlerResponseData,
	arrayFieldName: string,
	maxChars?: number,
): { data: HandlerResponseData; wasTruncated: boolean } => {
	const MAX_RESPONSE_CHARS = maxChars || DEFAULT_MAX_RESPONSE_CHARS;
	const jsonString = JSON.stringify(data, null, 2);

	if (jsonString.length <= MAX_RESPONSE_CHARS) {
		return { data, wasTruncated: false };
	}

	// If we exceeded the limit, progressively reduce the array size
	if (!hasArrayField(data, arrayFieldName)) {
		// If the field doesn't exist or isn't an array, return the original data
		return { data, wasTruncated: false };
	}

	const originalArray = (data as Record<string, unknown>)[
		arrayFieldName
	] as unknown[];
	let truncatedData: Record<string, unknown> = { ...data };
	let targetSize = Math.floor(originalArray.length * 0.8); // Start with 80%

	while (targetSize > 0) {
		truncatedData = {
			...data,
			[arrayFieldName]: originalArray.slice(0, targetSize),
			truncation_info: {
				total_available: originalArray.length,
				showing: targetSize,
				truncated: true,
				reason:
					"Response exceeded token limit - use smaller limit parameter or pagination",
			},
		};

		const testString = JSON.stringify(truncatedData, null, 2);
		if (testString.length <= MAX_RESPONSE_CHARS) {
			return { data: truncatedData, wasTruncated: true };
		}

		targetSize = Math.floor(targetSize * 0.8); // Reduce by 20% each iteration
	}

	// Fallback: return just metadata if even small arrays are too big
	return {
		data: {
			error: "Response too large even with truncation",
			total_available: originalArray.length,
			suggestion: "Use a smaller limit parameter or request specific items",
		},
		wasTruncated: true,
	};
};

// Validate arguments against tool schema
export function validateToolArgs(
	toolName: string,
	args: unknown,
	tools: unknown[],
): boolean {
	const tool = tools.find(
		(t: unknown) =>
			typeof t === "object" &&
			t !== null &&
			"name" in t &&
			(t as { name: unknown }).name === toolName,
	);
	if (!tool) return false;

	const schema = (tool as { inputSchema?: { required?: string[] } })
		.inputSchema;
	const required = schema?.required || [];

	// Basic validation - check required fields exist
	for (const field of required) {
		if (!(field in (args as object))) {
			throw new Error(`Missing required field: ${field}`);
		}
	}

	return true;
}

// Type guard function to check if a name is a valid tool handler
export function isValidToolName<T extends Record<string, unknown>>(
	name: string,
	handlers: T,
): name is keyof T & string {
	return name in handlers;
}
