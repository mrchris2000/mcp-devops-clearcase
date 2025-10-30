# MCP DevOps ClearCase Server

A Model Context Protocol (MCP) server implementation for DevOps ClearCase, enabling work item management through standardized MCP clients.

## Features

- Retrieve applications and projects from ClearCase
- Get available components and work item types
- Create, retrieve, and delete work items
- Filter work items by type and owner
- Simulate ClearCase operations for testing purposes
- Mock environment support for development without a valid ClearCase login

## Warranties
This MCP server is provided "as is" without any warranties. It is designed to work with the DevOps ClearCase system and may require specific configurations to function correctly. Users are responsible for ensuring compatibility with their ClearCase instance.
This server provides data destructive functionality, the author is not liable for any data loss due to use of this MCP capability.

## Configuration

The server requires configuration for authentication and connection to your ClearCase instance. You can provide configuration in several ways:

### Quick Setup (Recommended)

Run the interactive setup script:

```bash
npm run setup
```

This will prompt you for your configuration values and create a `.env` file automatically.

### Option 1: Environment Variables

No environment variables are required for this server.

### Option 2: Command Line Arguments

Pass configuration as command line arguments:

```bash
node src/lib/server.js
```

### Option 3: Environment File

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# Edit .env with your actual configuration values
```

## Installation

### Option 1: Direct NPX Usage (Recommended)

You can run the MCP server directly without installation:

```bash
npx @securedevops/mcp-devops-clearcase --mock-mode true
```

### Option 2: Global Installation

```bash
npm install -g @securedevops/mcp-devops-clearcase
mcp-devops-clearcase --mock-mode true
```

### Option 3: Local Development

```bash
git clone https://github.com/securedevops/mcp-devops-clearcase.git
cd mcp-devops-clearcase
npm install
npm run setup  # Interactive configuration setup
npm start      # Start the MCP server
```
