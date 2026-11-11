FROM node:24-alpine
# k6 is a single binary: it comes ready-made from the official image
COPY --from=grafana/k6:1.3.0 /usr/bin/k6 /usr/bin/k6
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json run.sh ./
COPY src ./src
COPY test ./test
COPY k6 ./k6
# Node 24 runs TypeScript directly (it strips the type annotations on load).
ENTRYPOINT ["sh", "run.sh"]
