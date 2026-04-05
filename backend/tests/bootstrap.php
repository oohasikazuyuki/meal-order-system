<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

// CakePHP定数（テスト環境用）
if (!defined('CONFIG')) {
    define('CONFIG', __DIR__ . '/../config/');
}
if (!defined('ROOT')) {
    define('ROOT', dirname(__DIR__));
}
if (!defined('APP')) {
    define('APP', __DIR__ . '/../src/');
}
if (!defined('WWW_ROOT')) {
    define('WWW_ROOT', __DIR__ . '/../webroot/');
}
if (!defined('LOGS')) {
    define('LOGS', __DIR__ . '/../logs/');
}
if (!defined('TMP')) {
    define('TMP', __DIR__ . '/../tmp/');
}
if (!defined('CACHE')) {
    define('CACHE', TMP . 'cache/');
}
if (!defined('DS')) {
    define('DS', DIRECTORY_SEPARATOR);
}
