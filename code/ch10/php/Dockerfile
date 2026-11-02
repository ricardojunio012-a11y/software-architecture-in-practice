# Stage 1: installs the dependencies (PHPUnit and deptrac) with Composer
FROM composer:2 AS dependencies
WORKDIR /app
COPY composer.json ./
RUN composer install --no-interaction --no-progress

# Stage 2: final image with only the command-line PHP
FROM php:8.3-cli-alpine
WORKDIR /app
COPY --from=dependencies /app/vendor ./vendor
COPY run.sh deptrac-before.yaml deptrac-after.yaml ./
COPY src ./src
COPY tests ./tests
ENTRYPOINT ["sh", "run.sh"]
