FROM oven/bun:1-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
RUN bunx prisma generate
EXPOSE 8080
CMD ["bun", "run", "src/app.ts"]
