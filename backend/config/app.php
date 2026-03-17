<?php
// app.php がロードされる時点では CakePHP の env() がまだ未定義のため
// PHP ネイティブの getenv() を使う
$e = static function (string $key, mixed $default = null): mixed {
    $val = getenv($key);
    return ($val === false) ? $default : $val;
};

return [
    'App' => [
        'namespace' => 'App',
        'encoding' => 'UTF-8',
        'defaultLocale' => 'ja_JP',
        'defaultTimezone' => 'Asia/Tokyo',
        'base' => false,
        'dir' => 'src',
        'webroot' => 'webroot',
        'wwwRoot' => WWW_ROOT,
        'fullBaseUrl' => false,
        'imageBaseUrl' => 'img/',
        'cssBaseUrl' => 'css/',
        'jsBaseUrl' => 'js/',
        'paths' => [
            'plugins' => [ROOT . DS . 'plugins' . DS],
            'templates' => [APP . 'templates' . DS],
            'locales' => [APP . 'Locale' . DS],
        ],
    ],
    'Asset' => [
        'cacheTime' => '+1 hour',
    ],
    'Security' => [
        'salt' => $e('SECURITY_SALT', 'meal-order-default-salt-change-me'),
    ],
    'Error' => [
        'errorLevel' => E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED,
        'skipLog' => [],
        'log' => true,
        'trace' => false,
        'ignoredDeprecationPaths' => [],
    ],
    'Datasources' => [
        'default' => [
            'className' => 'Cake\Database\Connection',
            'driver' => 'Cake\Database\Driver\Mysql',
            'persistent' => false,
            'host' => $e('DB_HOST', 'db'),
            'username' => $e('DB_USER', 'cake_user'),
            'password' => $e('DB_PASS', 'secret'),
            'database' => $e('DB_NAME', 'meal_order_db'),
            'encoding' => 'utf8mb4',
            'timezone' => 'Asia/Tokyo',
            'cacheMetadata' => true,
            'log' => false,
            'quoteIdentifiers' => false,
            'init' => ['SET NAMES utf8mb4 COLLATE utf8mb4_general_ci', 'SET CHARACTER SET utf8mb4'],
        ],
        'test' => [
            'className' => 'Cake\Database\Connection',
            'driver' => 'Cake\Database\Driver\Mysql',
            'persistent' => false,
            'host' => $e('DB_HOST', 'db'),
            'username' => $e('DB_USER', 'cake_user'),
            'password' => $e('DB_PASS', 'secret'),
            'database' => $e('DB_NAME', 'meal_order_db') . '_test',
            'encoding' => 'utf8mb4',
            'timezone' => 'Asia/Tokyo',
            'cacheMetadata' => true,
            'quoteIdentifiers' => false,
        ],
    ],
    'Cache' => [
        'default' => [
            'className' => 'Cake\Cache\Engine\FileEngine',
            'path' => CACHE,
        ],
        '_cake_core_' => [
            'className' => 'Cake\Cache\Engine\FileEngine',
            'prefix' => 'myapp_cake_core_',
            'path' => CACHE . 'persistent' . DS,
            'serialize' => true,
            'duration' => '+1 years',
        ],
        '_cake_model_' => [
            'className' => 'Cake\Cache\Engine\FileEngine',
            'prefix' => 'myapp_cake_model_',
            'path' => CACHE . 'models' . DS,
            'serialize' => true,
            'duration' => '+1 years',
        ],
        '_cake_routes_' => [
            'className' => 'Cake\Cache\Engine\FileEngine',
            'prefix' => 'myapp_cake_routes_',
            'path' => CACHE . 'persistent' . DS,
            'serialize' => true,
            'duration' => '+1 years',
        ],
        '_cake_translations_' => [
            'className' => 'Cake\Cache\Engine\FileEngine',
            'prefix' => 'myapp_cake_translations_',
            'path' => CACHE . 'persistent' . DS,
            'serialize' => true,
            'duration' => '+1 years',
        ],
    ],
    'Log' => [
        'debug' => [
            'className' => 'Cake\Log\Engine\FileLog',
            'path' => LOGS,
            'file' => 'debug',
            'scopes' => null,
            'levels' => ['notice', 'info', 'debug'],
        ],
        'error' => [
            'className' => 'Cake\Log\Engine\FileLog',
            'path' => LOGS,
            'file' => 'error',
            'scopes' => null,
            'levels' => ['warning', 'error', 'critical', 'alert', 'emergency'],
        ],
    ],
    'Session' => [
        'defaults' => 'php',
    ],
];
