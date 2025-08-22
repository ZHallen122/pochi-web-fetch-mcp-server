// Type definitions for the Web Fetch MCP Server

export interface Environment {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  PORT?: string;
}

export interface CloudflareWorkerContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface FetchToolInput {
  url: string;
}

export interface FetchToolResponse {
  content: string;
  isText: boolean;
}
