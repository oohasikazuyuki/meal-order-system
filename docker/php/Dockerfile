FROM php:8.5-fpm

RUN apt-get update && apt-get install -y \
    git curl unzip libpng-dev libonig-dev libxml2-dev libicu-dev \
    && docker-php-ext-install pdo pdo_mysql mbstring intl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

COPY docker/php/php.ini /usr/local/etc/php/conf.d/custom.ini

WORKDIR /var/www/html
