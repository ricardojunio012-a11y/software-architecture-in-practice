FROM node:24-alpine
# Alpine's PostgreSQL 17 brings pg_basebackup, pg_dump, and the server itself, used
# to restore the backup on a separate instance. su-exec runs the server as the
# postgres user (PostgreSQL refuses to run as root).
RUN apk add --no-cache postgresql17 postgresql17-client su-exec
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json run.sh ./
COPY src ./src
COPY test ./test
# Node 24 runs TypeScript directly (it strips the type annotations on load).
ENTRYPOINT ["sh", "run.sh"]
