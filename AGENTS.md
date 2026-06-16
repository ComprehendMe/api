# Repository Guidelines

## Project Structure & Module Organization
`src/app.ts` boots the server. `src/entry` wires Elysia, auth, and OpenAPI. Shared infrastructure lives in `src/common` (`prisma`, Redis/Dragonfly, queue, Gemini, mail, bucket helpers). Provider setup belongs in `src/config`. Feature code lives under `src/modules/<feature>`, usually with `index.ts` for routes and `service.ts` for business logic. Database files live in `prisma/schema.prisma` and `prisma/seed.ts`. Tests are in `src/test` and alongside modules as `*.test.ts`.

## Build, Test, and Development Commands
Use `docker-compose up -d` to start PostgreSQL and Dragonfly. Run `bun run dev` for local development, `bun run build` to compile to `dist/`, `bun run migrate` to generate Prisma client and run migrations, and `bun run seed` to load sample data. Use `bun test` for the real test runner. `bun run test` only executes `src/test/index.test.ts` directly and should not be treated as the full suite.

## Coding Style & Naming Conventions
This repository uses TypeScript with Biome. Follow tabs for indentation, single quotes, and organized imports as defined in `biome.json`. Prefer clear feature folder names such as `sessions`, `messages`, and `friends`. Use `PascalCase` for service classes (`MessageService`), `camelCase` for functions and variables, and keep route entry files named `index.ts`.

## API Summary
Current API coverage is partial and should be documented honestly:
- Auth: magic-link signup exists via `/sessions/signup` and `/sessions/verify`; cookies are used for session persistence. `/sessions/login` is email-based, not a complete magic-link login flow.
- Chats: `/chats` and `/chats/:chatId/messages` support creating chats, reading history, and queueing Gemini responses. Frontend polling is the safest assumption today.
- Patients: model and service exist, but public `/patients` routes are not exposed yet.
- Friends: backend routes and schema exist; treat frontend support as incomplete.
- Reports, payments, and WebSocket realtime are scaffolded/prepared, not complete product features.
- Security note: chat/message ownership checks need tightening before calling the API production-ready.

## Testing Guidelines
Write Bun tests as `*.test.ts`, preferably beside the module under test. Start local services and apply migrations before integration-style tests. Prioritize service-level coverage, then route-level checks for auth, chats, and messages.

## Commit, PR, and Config Notes
Recent commits use prefixes like `chore:`, `fix:`, and `wip:`, sometimes with scopes such as `chore(@me):`. Keep commits focused and imperative. PRs should summarize behavior changes, required env or migration steps, and example request/response payloads for endpoint changes. Keep secrets in `.env`; never commit provider, SMTP, Stripe, or bucket credentials.
