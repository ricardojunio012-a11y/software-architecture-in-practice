# The minimal OpenTofu image is only used to copy the binary (the documented use)
FROM ghcr.io/opentofu/opentofu:1.10.6-minimal AS tofu

FROM node:24-alpine
COPY --from=tofu /usr/local/bin/tofu /usr/local/bin/tofu
WORKDIR /app
# Downloads the OpenTofu providers once, when the image is built
COPY infra ./infra
RUN tofu -chdir=infra init -input=false
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json vitest.config.ts vitest.pipeline.ts .dependency-cruiser.cjs run.sh ./
COPY src ./src
COPY test ./test
# Node 24 runs TypeScript directly (it strips the type annotations on load).
ENTRYPOINT ["sh", "run.sh"]
