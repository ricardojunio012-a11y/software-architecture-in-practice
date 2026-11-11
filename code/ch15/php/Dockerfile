# Stage 1: installs the dependencies (Symfony YAML and PHPUnit) with Composer
FROM composer:2 AS dependencies
WORKDIR /app
COPY composer.json ./
RUN composer install --no-interaction --no-progress

# Stage 2: final image with only the PHP command line
FROM php:8.3-cli-alpine
# PostgreSQL driver (pdo_pgsql): builds the extension and keeps only the libpq library
RUN apk add --no-cache libpq \
    && apk add --no-cache --virtual .build $PHPIZE_DEPS postgresql-dev \
    && docker-php-ext-install pdo_pgsql \
    && apk del .build
WORKDIR /app
COPY --from=dependencies /app/vendor ./vendor
COPY run.sh ./
COPY public ./public
COPY src ./src
COPY tests ./tests
ENTRYPOINT ["sh", "run.sh"]
