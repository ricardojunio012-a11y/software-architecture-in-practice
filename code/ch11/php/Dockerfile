# Stage 1: installs the dependencies (php-amqplib and PHPUnit) with Composer
FROM composer:2 AS dependencies
WORKDIR /app
COPY composer.json ./
RUN composer install --no-interaction --no-progress

# Stage 2: final image with only the command-line PHP
FROM php:8.3-cli-alpine
# Extensions pdo_pgsql (PostgreSQL) and sockets (used by the RabbitMQ client):
# compiles the extensions and keeps only the libpq library
RUN apk add --no-cache libpq \
    && apk add --no-cache --virtual .build $PHPIZE_DEPS postgresql-dev linux-headers \
    && docker-php-ext-install pdo_pgsql sockets \
    && apk del .build
WORKDIR /app
COPY --from=dependencies /app/vendor ./vendor
COPY run.sh ./
COPY src ./src
COPY tests ./tests
ENTRYPOINT ["sh", "run.sh"]
