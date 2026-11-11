FROM node:24-alpine
# pg_dump and psql, for the nightly backup and the restore
RUN apk add --no-cache postgresql17-client
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json run.sh ./
COPY src ./src
COPY test ./test
# Node 24 runs TypeScript directly (it strips the type annotations on load).
ENTRYPOINT ["sh", "run.sh"]
