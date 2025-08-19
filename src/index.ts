import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "web-fetch-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

server.tool(
  "fetch",
  "Fetch content from a URL",
  {
    url: z.string().describe("The URL to fetch"),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
      .default("GET")
      .describe("HTTP method"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe("HTTP headers"),
    body: z
      .string()
      .optional()
      .describe("Request body for POST/PUT/PATCH requests"),
  },
  async ({ url, method, headers, body }) => {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "User-Agent": "web-fetch-mcp/1.0.0",
          ...headers,
        },
        body: method !== "GET" && method !== "DELETE" ? body : undefined,
      });

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const isText =
        contentType.includes("text/") ||
        contentType.includes("application/json");

      let responseBody;
      if (isJson) {
        responseBody = await response.json();
      } else if (isText) {
        responseBody = await response.text();
      } else {
        responseBody = `Binary content (${contentType})`;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBody,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching ${url}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Web Fetch MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
