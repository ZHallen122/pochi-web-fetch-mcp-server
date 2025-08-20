import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import dotenv from "dotenv";
import { Environment, CloudflareWorkerContext } from "./types.js";
import { createServer } from "./server.js";
import { createTransport } from "./transport.js";

// Load environment variables for local development
dotenv.config();

// Global variable to store environment
let globalEnv: Environment | null = null;

// Initialize app and transport globally
const app = new Hono();
const transport = createTransport();

// Global server instance
let mcpServer: McpServer | null = null;
let serverConnected = false;

async function initializeServer(env: Environment) {
  if (!serverConnected) {
    if (!mcpServer) {
      mcpServer = createServer(env);
    }
    await mcpServer.connect(transport);
    serverConnected = true;
    console.log("MCP Server connected to transport");
  }
}

// Configure MCP endpoint
app.post("/mcp", async (c) => {
  console.log("Received POST MCP request");

  try {
    // Get env from context (for Cloudflare Workers)
    const env = c.env || globalEnv || {};
    await initializeServer(env as Environment);

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

// Add a health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", message: "Web Fetch MCP Server is running" });
});

// Export default for Cloudflare Workers
export default {
  async fetch(
    request: Request,
    env: Environment,
    ctx: CloudflareWorkerContext
  ): Promise<Response> {
    // Store env globally for access in handlers
    globalEnv = env;
    // Type assertion needed for Hono compatibility
    return app.fetch(request, env, ctx as any);
  },
};
