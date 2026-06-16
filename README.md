# ComprehendMe — Virtual Patient AI Backend

API for virtual patient simulation, AI therapy chat, reports, and session management. Built with Elysia + Bun.

## Main endpoints

### Authentication

- `POST /sessions/signup` — User registration (magic link)
- `POST /sessions/login` — Login and magic link
- `GET /users/@me` — Authenticated user profile

### Users

- `GET /users/profile` — User profile
- `POST /users/@me/onboarding` — Complete sign-up profile steps

### Patients

- `GET /patients` — List virtual patients
- `GET /patients/:id` — Patient details

### Sessions & chat

- `POST /sessions/start` — Start therapy session
- `POST /chat/:sessionId` — Send message to virtual patient (AI)
- `PUT /sessions/:sessionId/end` — End session

## Local development

1. Copy `api/.env.example` to `api/.env` and fill in values.
2. Start PostgreSQL and Dragonfly: `docker compose up -d`
3. Apply schema changes and regenerate Prisma Client: `bun run migrate`
4. (If you only pulled code changes) run `npx prisma generate`
5. Seed canonical patients: `bun run seed`
6. Start API: `bun run dev`
6. Open `http://localhost:<PORT>/docs` for API documentation.

### Prisma sync checklist

If you see errors such as `Unknown argument reviewStatus`:

1. Stop API/worker processes.
2. Run `bun run migrate` (or `npx prisma migrate deploy` in production).
3. Run `npx prisma generate`.
4. Start the API again.

## Storage

- **Local:** MinIO via Docker (`docker compose up -d`)
- **Production:** Cloudflare R2

Avatars, reports, transcripts, and backups use object storage.
# api
