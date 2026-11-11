FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json vitest.config.ts run.sh ./
COPY src ./src
COPY test ./test
# Node 24 runs TypeScript directly (it strips the type annotations on load).
ENTRYPOINT ["sh", "run.sh"]
