# MCP Server

A Model Context Protocol (MCP) server implementation using Node.js and TypeScript.

## What is MCP?

The Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to LLMs (Large Language Models). It allows for seamless communication between AI applications and various data sources and tools.

## Features

This server implementation provides:

- A calculator tool with basic arithmetic operations (add, subtract, multiply, divide)
- Server information resource with system metrics
- Echo resource for message reflection
- Greeting prompt template with formal/casual options
- Code review prompt template
- Support for both stdio and HTTP/SSE transport methods
- Comprehensive logging system

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

### Running the Server

#### Using stdio (for integration with MCP clients)

```bash
npm start
```

#### Using HTTP/SSE (for web-based usage)

```bash
npm start -- --http
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start -- --http
```

## API

### Tools

- `calculate`: Perform arithmetic operations
  - Parameters: 
    - `operation` (add/subtract/multiply/divide)
    - `a` (number)
    - `b` (number)

### Resources

- `server://info`: Get server information including:
  - Server name and version
  - Uptime
  - Node.js version
  - Platform
  - Memory usage
- `echo://{message}`: Echo back the provided message

### Prompts

- `greeting`: Generate personalized greetings
  - Parameters:
    - `name` (string): Name to greet
    - `formal` (optional string): Whether to use formal language
- `code-review`: Review code for improvements
  - Parameters:
    - `code` (string): Code to review
    - `language` (string): Programming language
    - `focus` (optional string): Review focus area

## Development

To run the server in development mode with auto-reloading:

```bash
npm run dev
```

For HTTP/SSE transport in development mode:

```bash
npm run dev -- --http
```

## License

ISC 