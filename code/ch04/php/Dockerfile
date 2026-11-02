# Stage 1: installs the dependencies (PHPUnit) with Composer
FROM composer:2 AS dependencies
WORKDIR /app
COPY composer.json ./
RUN composer install --no-interaction --no-progress --ignore-platform-req=php

# Stage 2: final image with only the command-line PHP
FROM php:8.3-cli-alpine
WORKDIR /app
COPY --from=dependencies /app/vendor ./vendor
COPY run.sh ./
COPY src ./src
COPY tests ./tests
ENTRYPOINT ["sh", "run.sh"]
