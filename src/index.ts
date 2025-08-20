import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { z } from "zod";

const server = new McpServer({
  name: "web-fetch-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

async function runServer() {
  const app = new Hono();

  // Configure MCP endpoint
  app.post("/mcp", async (c) => {
    console.log("Received POST MCP request");

    const body = await c.req.json();

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
      });

      const { req, res } = toReqRes(c.req.raw);
      res.on("close", () => {
        transport.close();
        server.close();
      });

      await server.connect(transport);
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
