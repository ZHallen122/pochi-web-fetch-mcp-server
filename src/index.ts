import { Hono } from "hono";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import dotenv from "dotenv";
import { Environment, CloudflareWorkerContext } from "./types.js";
import { createServer } from "./server.js";
import { createTransport } from "./transport.js";

// Load environment variables for local development
dotenv.config();

const app = new Hono();

// Configure MCP endpoint
app.post("/mcp", async (c) => {
  console.log("Received POST MCP request");

  const { req, res } = toReqRes(c.req.raw);

  // Get env from context (for Cloudflare Workers) or process.env for local
  const env = c.env || process.env;

  // Create new server and transport for each request
  const server = createServer(env as Environment);

  try {
    const transport = createTransport();

    // Added for extra debuggability
    transport.onerror = console.error.bind(console);

    await server.connect(transport);

    await transport.handleRequest(req, res, await c.req.json());

    res.on("close", () => {
      console.log("Request closed");
      transport.close();
      server.close();
    });

    return toFetchResponse(res);
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
      { status: 500 }
    );
  }
});

// Add a health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", message: "Web Fetch MCP Server is running" });
});

// Add GET and DELETE handlers for better compatibility
app.get("/mcp", async (c) => {
  console.log("Received GET MCP request");
  return c.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    },
    { status: 405 }
  );
});

app.delete("/mcp", async (c) => {
  console.log("Received DELETE MCP request");
  return c.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    },
    { status: 405 }
  );
});

// Export default for Cloudflare Workers
export default {
  async fetch(
    request: Request,
    env: Environment,
    ctx: CloudflareWorkerContext
  ): Promise<Response> {
    // Type assertion needed for Hono compatibility
    return app.fetch(request, env, ctx as any);
  },
};
