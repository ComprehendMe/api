# Cogni AI — Backend Paciente Virtual com IA

API para simulação de pacientes virtuais, chat terapêutico com IA, relatórios e gestão de sessões. Construída com Elysia + Bun seguindo Clean Architecture.

---

## 2. Fluxo por Módulo

### 2.1. Autenticação

- `POST /auth/register` — Registo de utilizador
- `POST /auth/login` — Login e emissão de JWT
- `GET /auth/me` — Dados do utilizador autenticado
- `POST /auth/refresh` — Renova token (opcional)

JWT via header `Authorization`. Sessões ativas em Redis.

### 2.2. Utilizadores

- `GET /users/profile` — Perfil do utilizador
- `PATCH /users/profile` — Atualiza dados
- `DELETE /users/account` — Elimina conta

### 2.3. Pacientes

- `GET /patients` — Lista de pacientes virtuais
- `GET /patients/:id` — Detalhes de paciente

Cache Redis para performance. Dados estáticos geridos por admin/seed.

### 2.4. Sessões & Chat

- `POST /sessions/start` — Inicia sessão terapêutica
- `POST /chat/:sessionId` — Envia mensagem para paciente virtual (IA)
- `PUT /sessions/:sessionId/end` — Encerra sessão
- `GET /sessions/:sessionId/report` — Relatório detalhado
- `GET /sessions/history` — Histórico de sessões
- `GET /sessions/:sessionId` — Detalhes da sessão

Sessão ativa em Redis, persistência em PostgreSQL, chat processado via Gemini API.

### 2.5. IA & Relatórios

- Prompt generator, integração Gemini, análise e geração de relatórios
- Relatórios completos armazenados em MinIO e PostgreSQL
- Fila assíncrona em Redis para processamento de relatórios

### 2.6. Armazenamento (MinIO)

- Relatórios, transcrições, backups
- Estrutura de buckets organizada por utilizador e sessão

### 2.7. Cache (Redis)

- Sessões, pacientes, histórico, fila de análise
- TTL configurado por tipo de dado

### 2.8. Fila Assíncrona

- Processamento de relatórios sem bloquear requisições
- Worker background processa fila `analysis:queue`

---

## 3. Fluxo Integrado Ponta a Ponta

```
[Utilizador] → [Registo/Login] → [Selecionar Paciente] → [Iniciar Sessão] → [Chat IA] → [Encerrar Sessão] → [Fila de Análise] → [Relatório] → [Histórico]
```

---

## 4. Tecnologias

| Tecnologia   | Responsabilidade           |
| ------------ | -------------------------- |
| Elysia + Bun | Framework web e runtime    |
| PostgreSQL   | Dados persistentes         |
| Redis        | Cache, sessões, fila       |
| Gemini API   | IA generativa              |
| R2 OR S3        | Armazenamento de arquivos |

---

## 6. Ambiente (.env)

```env
DATABASE_URL=
REDIS_HOST=
REDIS_PORT=
JWT_SECRET=
MINIO_ENDPOINT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
GEMINI_API_KEY=
```

---

## 7. Como rodar localmente

1. Instale dependências:
   ```powershell
   bun install
   ```
2. Configure `.env` (veja `.env.example`)
3. Suba serviços Docker:
   ```powershell
   docker-compose up -d
   ```
4. Migre banco de dados:
   ```powershell
   bunx prisma migrate dev
   ```
5. Inicie o servidor:
   ```powershell
   bun run api
   ```
6. Acesse `http://localhost:<PORT>/docs` para explorar endpoints.

---

## 8. Estrutura do Projeto

```
api/
├── src/
│   ├── app.ts
│   ├── common/
│   ├── config/
│   ├── entry/
│   └── modules/
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── package.json
├── README.md
└── tsconfig.json
```

---


