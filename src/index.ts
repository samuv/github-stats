#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { createGitHubService } from './github/index.js';
import { tools, createToolHandlers } from './tools/index.js';
import { isValidToolName, truncateResponse, validateToolArgs } from './utils/helpers.js';


// Initialize GitHub service
// The GitHub token can be provided via environment variable
const github = createGitHubService({
  token: process.env.GITHUB_TOKEN,
  batchSize: 10,
  delayBetweenBatches: 1000
});

// Create tool handlers
const toolHandlers = createToolHandlers(github, truncateResponse);

// Create the MCP server
const server = new Server(
  {
    name: 'github-stats-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.log(JSON.stringify(args))

  if (!args) {
    throw new Error('Arguments are required');
  }

  console.error(`Tool called: ${name}`);
  console.error(`Arguments:`, JSON.stringify(args, null, 2));
  
  // Check if the client provided a token limit hint
  const tokenLimit = (args.max_tokens || args.token_limit || args.max_response_tokens) as number | undefined;
  const maxChars = tokenLimit ? tokenLimit * 4 : undefined; // Rough conversion
  
  if (tokenLimit) {
    console.error(`Token limit hint provided: ${tokenLimit} tokens (~${maxChars} chars)`);
  }

  try {
    // Check if the tool name is valid using our type guard
    if (!isValidToolName(name, toolHandlers)) {
        throw new Error(`Unknown tool: ${name}`);
    }

    // Validate arguments against the tool's schema
    validateToolArgs(name, args, tools);

    // Get the handler function for this tool (TypeScript now knows name is a valid key)
    const handler = toolHandlers[name];

    // Call the handler with the arguments and maxChars
    return await handler(args as any, maxChars);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log server info to stderr so it doesn't interfere with the MCP protocol
  console.error('GitHub Stats MCP Server running...');
  console.error('Available tools:');
  tools.forEach(tool => {
    console.error(`  - ${tool.name}: ${tool.description}`);
  });
  
  if (!process.env.GITHUB_TOKEN) {
    console.error('Warning: No GITHUB_TOKEN environment variable set. API rate limits will be lower.');
    console.error('Set GITHUB_TOKEN to increase rate limits and access private repositories.');
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});