# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flowise is a visual LLM orchestration tool that allows users to build AI agents using a drag-and-drop interface. The project is a monorepo consisting of multiple packages:

- `server`: Node.js backend that serves API logic
- `ui`: React frontend
- `components`: Third-party node integrations (LLMs, embeddings, document loaders, etc.)
- `api-documentation`: Auto-generated swagger-ui API docs from express

## Development Setup

### Prerequisites

- Node.js >= 18.15.0
- PNPM >= 9 (`npm i -g pnpm`)

### Common Commands

```bash
# Install all dependencies of all modules
pnpm install

# Build all code
pnpm build

# Start the application (production mode)
pnpm start

# Development mode
pnpm dev

# Clean the project
pnpm clean

# Completely rebuild (for major dependency changes)
pnpm build-force

# Lint code
pnpm lint

# Fix linting issues
pnpm lint-fix
```

### Development Notes

When working in development mode:
1. Create `.env` file in `packages/ui` and specify `VITE_PORT` (see `.env.example`)
2. Create `.env` file in `packages/server` and specify `PORT` (see `.env.example`)
3. Run `pnpm dev` to start development servers

The UI will be available at http://localhost:8080 (or your configured VITE_PORT).

## Architecture

Flowise is built on a modular architecture that separates concerns:

1. **Components Package**: Contains implementations of various AI components:
   - Chat models (OpenAI, Anthropic, etc.)
   - Embeddings
   - Document loaders
   - Vector stores
   - Memory systems
   - Agent implementations
   - Tools and utilities

2. **Server Package**: Provides the backend API:
   - RESTful endpoints
   - Authentication
   - Chatflow execution
   - Database connections
   - File storage

3. **UI Package**: React-based frontend:
   - Flow builder with node-based editor
   - Settings panels
   - Chatbot interface
   - Admin dashboard

4. **AgentFlow**: The system's core functionality that enables visual AI agent building:
   - Nodes represent different AI capabilities
   - Connections define the flow of data between nodes
   - The system translates visual flows into executable LangChain/LlamaIndex code

## Docker Usage

### Development with Docker

```bash
# Build and run with docker compose (from docker directory)
cd docker
cp .env.example .env  # Edit as needed
docker compose up -d

# Using provided docker image
docker build --no-cache -t flowise .
docker run -d --name flowise -p 3000:3000 flowise
```

## Testing

The project uses Cypress for end-to-end testing:

```bash
# Run from packages/server
cd packages/server
# Start cypress
npx cypress open
```

## Environment Variables

Key environment variables (set in `packages/server/.env`):

- `PORT`: HTTP port for the server (default: 3000)
- `FLOWISE_USERNAME`/`FLOWISE_PASSWORD`: App authentication
- `DATABASE_TYPE`: Type of database to use (`sqlite`, `mysql`, `postgres`)
- `DATABASE_PATH`: Path for SQLite database
- `SECRETKEY_PATH`: Path for encryption key storage
- `STORAGE_TYPE`: Type of file storage (`local`, `s3`, `gcs`)

Refer to CONTRIBUTING.md for a complete list of supported environment variables.

## Components Development

When developing new components:
1. Add component implementations in `packages/components/nodes/`
2. Components should follow existing patterns for metadata and interface compatibility
3. Run `pnpm build` after changes to components
4. Restart the server to pick up component changes

## Troubleshooting

- If you encounter "JavaScript heap out of memory" during build:
  ```bash
  export NODE_OPTIONS="--max-old-space-size=4096"
  pnpm build
  ```

- For database connection issues, verify the database configuration in the `.env` file