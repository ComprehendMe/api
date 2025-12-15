# Análise do Projeto: Comprehend Me

Este documento detalha a análise da arquitetura atual do projeto CogniAI e propõe um plano de implementação para as funcionalidades de chat com LLMs da Gemini, sistema de amigos e streaks.

## 1. Visão Geral

O objetivo é construir uma plataforma para psicólogos que ofereça um sistema de chat onde os pacientes possam interagir com Large Language Models (LLMs) especializados. Para aumentar o engajamento, a plataforma também contará com um sistema de amizades entre usuários e um contador de "streaks" por dias consecutivos de uso.

## 2. Análise da Arquitetura Atual

O projeto possui uma base sólida, moderna e bem-estruturada, utilizando tecnologias de alta performance.

- **Tecnologias Principais:**
  - **Framework API:** [Hono](https://hono.dev/) (executado sobre Bun), conhecido pela sua leveza e performance.
  - **ORM & Migrations:** [Prisma](https://www.prisma.io/), para uma interação segura e tipada com o banco de dados.
  - **Banco de Dados:** PostgreSQL (inferido pelo `provider` no `schema.prisma`).
  - **Cache/Sessões:** [DragonflyDB](https://www.dragonflydb.io/), um substituto performático para o Redis, usado para gerenciamento de sessões.
  - **Autenticação:** [Lucia-auth](https://lucia-auth.com/), uma biblioteca moderna para autenticação e gerenciamento de sessões.
  - **Linguagem:** TypeScript, garantindo robustez e manutenibilidade.
  - **Runtime:** [Bun](https.bun.sh), um runtime JavaScript extremamente rápido.

- **Estrutura de Diretórios:**
  - `prisma/`: Contém o schema do banco de dados (`schema.prisma`), seeds e migrações.
  - `src/`: Coração da aplicação.
    - `src/common/`: Módulos reutilizáveis como configuração do Prisma, Dragonfly, e-mail, etc.
    - `src/modules/`: Lógica de negócio, dividida em módulos (`users`, `sessions`, `payments`). Este padrão é ideal para a expansão.
    - `src/app.ts`: Arquivo principal que inicializa o Hono e registra as rotas dos módulos.
    - `src/entry/index.ts`: Ponto de entrada que inicia o servidor HTTP.

- **Banco de Dados (`schema.prisma`):**
  - O schema atual define os modelos `User` e `Session`, focados exclusivamente na autenticação e identificação de usuários.

## 3. Plano de Implementação

Para integrar as novas funcionalidades, sugiro as seguintes etapas.

### 3.1. Expansão do Schema do Banco de Dados

Primeiro, precisamos modelar as novas entidades no arquivo `prisma/schema.prisma`. As alterações incluem os modelos de chat, o sistema de amigos e os campos de streak.

```prisma
// Adicionar/alterar em prisma/schema.prisma

// Altere o modelo User para incluir as relações de amizade
model User {
  id    String @id
  email String @unique
  // ... (campos existentes)

  // Relações para sistema de amigos
  sentFriendRequests     Friendship[] @relation("sentFriendRequests")
  receivedFriendRequests Friendship[] @relation("receivedFriendRequests")
}

// Representa o profissional de psicologia
model Psychologist {
  id     String @id
  user   User   @relation(fields: [id], references: [id])
  chats  ChatSession[]
}

// Representa o paciente
model Patient {
  id     String @id
  user   User   @relation(fields: [id], references: [id])
  chats  ChatSession[]

  // Campos para o sistema de Streak
  streakCount      Int      @default(0)
  lastActivityDate DateTime?
}

// Representa um bot com sua personalidade e configuração
model Bot {
  id            String   @id @default(cuid())
  name          String
  description   String
  systemPrompt  String   @db.Text
  level         Int
  
  chatSessions  ChatSession[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Representa uma sessão de chat entre um paciente e um bot
model ChatSession {
  id        String   @id @default(cuid())
  patientId String
  patient   Patient  @relation(fields: [patientId], references: [id])
  botId     String
  bot       Bot      @relation(fields: [botId], references: [id])
  
  psychologistId String?
  psychologist   Psychologist? @relation(fields: [psychologistId], references: [id])
  
  messages  ChatMessage[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

// Representa uma única mensagem no chat
model ChatMessage {
  id        String   @id @default(cuid())
  session   ChatSession @relation(fields: [sessionId], references: [id])
  sessionId String
  
  role      String // 'user' ou 'model'
  content   String   @db.Text
  
  createdAt DateTime @default(now())
}

// Novo: Modelo para o sistema de amigos
model Friendship {
  id          String   @id @default(cuid())
  requesterId String
  requester   User     @relation("sentFriendRequests", fields: [requesterId], references: [id])
  addresseeId String
  addressee   User     @relation("receivedFriendRequests", fields: [addresseeId], references: [id])
  
  status      FriendshipStatus @default(PENDING)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([requesterId, addresseeId])
}

// Novo: Enum para o status da amizade
enum FriendshipStatus {
  PENDING
  ACCEPTED
  DECLINED
  BLOCKED
}
```

**Após alterar o schema, execute a migração:**
```bash
bunx prisma migrate dev --name social_features
```

### 3.2. Lógica de Negócio e Serviços

#### Serviço de Integração com Gemini
Crie um serviço centralizado para a API do Gemini, conforme detalhado anteriormente, em `src/common/gemini.ts`.

#### Módulo de Chat (`src/modules/chat/`)
- **`service.ts`:** Este serviço irá orquestrar a lógica do chat. Ao enviar uma mensagem, ele deve:
  1. Salvar a mensagem do usuário no banco.
  2. **Atualizar o streak:** Chamar um novo serviço (`StreakService`) que verifica a `lastActivityDate` do paciente e atualiza o `streakCount`.
  3. Chamar o `gemini.ts` para obter a resposta do bot.
  4. Salvar a resposta do bot no banco.

#### Novo Módulo: `friends` (`src/modules/friends/`)
Crie um novo módulo para gerenciar as amizades, com a mesma estrutura `index.ts`, `service.ts` e `model.ts`.

### 3.3. Endpoints da API (Rotas)

#### Rotas de Chat (em `src/modules/chat/index.ts`)
- `POST /chats`: Cria uma nova sessão de chat.
- `GET /chats/:chatId/messages`: Retorna as mensagens de um chat.
- `POST /chats/:chatId/messages`: Envia uma nova mensagem para um chat (esta rota acionará a lógica de streak).

#### Novas Rotas de Amizade (em `src/modules/friends/index.ts`)
- `GET /friends`: Lista os amigos do usuário logado (status `ACCEPTED`).
- `GET /friends/requests`: Lista os pedidos de amizade pendentes (`PENDING`).
- `POST /friends/requests`: Envia um pedido de amizade para outro usuário (body: `{ userId: "..." }`).
- `PUT /friends/requests/:requestId`: Aceita ou recusa um pedido (body: `{ status: "ACCEPTED" | "DECLINED" }`).
- `DELETE /friends/:friendshipId`: Desfaz uma amizade.

#### Rota de Perfil do Usuário
- Aconselha-se que a rota que retorna os dados do usuário logado (ex: `GET /auth/me`) também retorne o `streakCount`.

## 4. Próximos Passos Sugeridos

1.  **Atualizar Schema:** Copie o código Prisma da seção 3.1 para `prisma/schema.prisma`.
2.  **Executar Migração:** Rode `bunx prisma migrate dev --name social_features` no terminal.
3.  **Criar Serviço Gemini:** Implemente `src/common/gemini.ts` e adicione a `GEMINI_API_KEY` ao `.env`.
4.  **Desenvolver Módulo de Chat:** Crie e implemente o módulo em `src/modules/chat/`, incluindo a lógica para chamar o serviço de streak.
5.  **Desenvolver Módulo de Amigos:** Crie e implemente o novo módulo em `src/modules/friends/`.
6.  **Criar Serviço de Streak:** Crie um `src/common/streak.ts` (ou dentro do módulo de usuários) para encapsular a lógica de atualização de streaks.
7.  **Registrar Rotas:** Importe e use os módulos `chat` e `friends` no arquivo `src/app.ts`.
8.  **Criar Bots via Seed:** Use o `prisma/seed.ts` para popular o banco de dados com os bots iniciais.
