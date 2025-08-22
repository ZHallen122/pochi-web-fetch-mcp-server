import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
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
    "Fetch a URL and analyze its content using Google Gemini with URL Context",
    {
      url: z.string().describe("The URL to fetch and analyze"),
    },
    async ({ url }: FetchToolInput & { prompt?: string }) => {
      try {
        // Try to get API key from Cloudflare Workers env first, then fallback to process.env
        const apiKey =
          env?.GOOGLE_GENERATIVE_AI_API_KEY ||
          process.env.GOOGLE_GENERATIVE_AI_API_KEY;

        if (!apiKey) {
          throw new Error(
            "GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set"
          );
        }

        // Use default prompt if none provided
        const analysisPrompt = `Please fetch the content from this URL and return it in markdown format: ${url}`;

        const googleAI = createGoogleGenerativeAI({
          apiKey: apiKey,
        });

        const { text, providerMetadata } = await generateText({
          model: googleAI("gemini-2.5-flash"),
          prompt: analysisPrompt,
          tools: {
            url_context: google.tools.urlContext({}),
          },
        });

        // Extract metadata for debugging/logging
        const metadata = providerMetadata?.google;
        const urlContextMetadata = metadata?.urlContextMetadata;
        const groundingMetadata = metadata?.groundingMetadata;

        return {
          content: [
            {
              type: "text",
              text: text,
            },
          ],
          metadata: {
            urlContextMetadata,
            groundingMetadata,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing URL: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
