import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { z } from "zod";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const server = new McpServer({
  name: "web-fetch-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

// Add the fetch tool
server.registerTool(
  "fetch",
  {
    description: "Fetch a URL and convert it to markdown using Jina",
    inputSchema: {
      url: z.string().describe("The URL to fetch and convert to markdown"),
    },
  },
  async ({ url }: { url: string }) => {
    try {
      const jinaUrl = `https://r.jina.ai/${url}`;
      const token = process.env.JINA_TOKEN;
      
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
      
      const markdown = await response.text();
      
      return {
        content: [
          {
            type: "text",
            text: markdown,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function runServer() {
  const app = new Hono();

  // Create transport and connect server once
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  });

  await server.connect(transport);

  // Configure MCP endpoint
  app.post("/mcp", async (c) => {
    console.log("Received POST MCP request");

    try {
      const { req, res } = toReqRes(c.req.raw);
      const body = await c.req.json();
      
      await transport.handleRequest(req, res, body);
      return await toFetchResponse(res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      return c.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        },
        500
      );
    }
  });

  const port = process.env.PORT || 8000;
  console.log(`Web Fetch MCP Server running on http://localhost:${port}`);

  return { fetch: app.fetch };
}

// Start the server
runServer()
  .then(async ({ fetch }) => {
    const port = process.env.PORT || 8000;

    // Create a simple HTTP server for Node.js
    const { createServer } = await import("node:http");

    const server = createServer(async (req, res) => {
      // Collect request body
      let body: string | undefined;
      if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks).toString();
      }

      const request = new Request(`http://localhost:${port}${req.url}`, {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: body,
      });

      const response = await fetch(request);

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    });

    server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
