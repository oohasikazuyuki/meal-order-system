FROM php:8.5-fpm

RUN apt-get update && apt-get install -y \
    git curl unzip libpng-dev libonig-dev libxml2-dev libicu-dev \
    libzip-dev libfreetype6-dev libjpeg62-turbo-dev \
    && docker-php-ext-install pdo pdo_mysql mbstring intl zip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# LibreOffice（Excel→PDF変換）＋日本語フォント
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-calc \
    fonts-noto-cjk \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

COPY docker/php/php.ini /usr/local/etc/php/conf.d/custom.ini

WORKDIR /var/www/html
