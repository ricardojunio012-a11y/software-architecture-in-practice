FROM node:24-alpine
# git: the lab creates a real repository and reads the history with git log
RUN apk add --no-cache git
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json run.sh assumptions.json ./
COPY src ./src
COPY test ./test
# Node 24 runs TypeScript directly (it strips the type annotations on load).
ENTRYPOINT ["sh", "run.sh"]
