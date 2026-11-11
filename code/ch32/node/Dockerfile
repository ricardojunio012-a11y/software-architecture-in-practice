# Stage 1: the function package. The Lambda nodejs22.x runtime loads only JavaScript,
# so Node 24 itself strips the types from report.ts and the result goes into a .zip
FROM node:24-alpine AS package
RUN apk add --no-cache zip
WORKDIR /source
COPY src/function/report.ts ./
RUN node -e "const fs = require('node:fs'), m = require('node:module'); \
  const ts = fs.readFileSync('report.ts', 'utf8'); \
  fs.writeFileSync('report.mjs', m.stripTypeScriptTypes(ts))" \
 && zip -q -X /source/report.zip report.mjs

# Stage 2: the lab image. It takes only what it needs to run
FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json run.sh ./
COPY src ./src
COPY test ./test
COPY --from=package /source/report.zip ./package/
# Node 24 runs TypeScript directly (it strips the type annotations on load).
ENTRYPOINT ["sh", "run.sh"]
