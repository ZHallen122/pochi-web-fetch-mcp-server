# web-fetch-mcp

A Model Context Protocol (MCP) server that fetches and analyzes web content using Google Gemini 2.5 Flash with URL Context tool.

## Features

- Fetch and analyze web content using Google Gemini AI
- URL Context tool for direct URL analysis
- Support for custom prompts to guide content analysis
- Built-in grounding metadata for source attribution

## Installation

To install dependencies:

```bash
bun install
```

## Configuration

Copy the example environment file and configure your API key:

```bash
cp .env.example .env
```

Edit `.env` and add your Google Generative AI API key:

```
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

## Usage

To build and run:

```bash
bun run build
bun run start
```

## Cloudflare Workers Deployment

### Development

```bash
npx wrangler dev
```

### Deploy

Set your API key as a secret:

```bash
wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
```

Optionally set the port:

```bash
wrangler secret put PORT
```

Deploy to Cloudflare Workers:

```bash
wrangler deploy
```

## API

The server provides a `fetch` tool that accepts:

- `url` (required): The URL to fetch and analyze
- `prompt` (optional): Custom prompt to guide the analysis

Example usage:
```json
{
  "url": "https://example.com",
  "prompt": "Summarize the main points of this article"
}
```
