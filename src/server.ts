import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fetch from "node-fetch";
import { Environment, FetchToolInput } from "./types.js";

export function createServer(env: Environment): McpServer {
  const server = new McpServer(
    {
      name: "web-fetch-mcp",
      version: "1.0.0",
    },
    { capabilities: { tools: {} } }
  );

  // Added for extra debuggability
  server.server.onerror = console.error.bind(console);

  // Add the fetch tool
  server.tool(
    "fetch",
    "Fetch a URL and convert it to markdown using Jina",
    {
      url: z.string().describe("The URL to fetch and convert to markdown"),
    },
    async ({ url }: FetchToolInput) => {
      try {
        const jinaUrl = `https://r.jina.ai/${url}`;
        // Try to get token from Cloudflare Workers env first, then fallback to process.env
        const token = env?.JINA_TOKEN || process.env.JINA_TOKEN;
        
        if (!token) {
          throw new Error("JINA_TOKEN environment variable is not set");
        }
        
        const response = await fetch(jinaUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const content = await response.text();
        
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching URL: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}