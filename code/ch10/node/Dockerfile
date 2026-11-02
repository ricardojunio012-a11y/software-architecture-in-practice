FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json run.sh .dependency-cruiser.cjs ./
COPY src ./src
COPY test ./test
# Node 24 runs TypeScript directly (it strips the type annotations on load).
ENTRYPOINT ["sh", "run.sh"]
