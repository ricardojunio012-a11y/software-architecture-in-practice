FROM node:24-slim
WORKDIR /app
COPY package.json ./
# DuckDB ships a native binary for Linux with glibc; hence the slim image rather than
# the alpine one
RUN npm install --no-audit --no-fund
COPY tsconfig.json run.sh ./
COPY src ./src
COPY test ./test
# Node 24 runs TypeScript directly (it strips the type annotations on load).
ENTRYPOINT ["sh", "run.sh"]
