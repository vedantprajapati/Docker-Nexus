# Docker Nexus Documentation

## Running the Documentation

You can run the documentation site in isolation using Docker or locally via NPM.

### Option 1: Docker (Recommended)
Run the following command from the `docs/` directory:
```bash
docker compose up -d
```
The site will be available at http://localhost:3051.

### Option 2: Local NPM
If you have Node.js installed:
```bash
npm install
npm start
```
The site will be available at http://localhost:3000 (default Docusaurus port).

## Structure
- `docs/`: Markdown content files.
- `src/`: Custom React components and pages.
- `docusaurus.config.ts`: Site configuration.
