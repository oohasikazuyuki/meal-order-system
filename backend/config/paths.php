<?php
declare(strict_types=1);

/*
 * CakePHP の各種パス定数。webroot/index.php と migrate.php の双方から読み込む。
 */

if (!defined('DS')) {
    define('DS', DIRECTORY_SEPARATOR);
}

define('ROOT', dirname(__DIR__));
define('APP_DIR', 'src');
define('WEBROOT_DIR', 'webroot');
define('WWW_ROOT', ROOT . DS . WEBROOT_DIR . DS);
define('CONFIG', ROOT . DS . 'config' . DS);
define('APP', ROOT . DS . APP_DIR . DS);
define('CACHE', ROOT . DS . 'tmp' . DS . 'cache' . DS);
define('LOGS', ROOT . DS . 'logs' . DS);
define('TMP', ROOT . DS . 'tmp' . DS);
define('RESOURCES', ROOT . DS . 'resources' . DS);
define('TESTS', ROOT . DS . 'tests' . DS);
define('CORE_PATH', ROOT . DS . 'vendor' . DS . 'cakephp' . DS . 'cakephp' . DS);
define('CAKE_CORE_INCLUDE_PATH', CORE_PATH);
define('CAKE', CORE_PATH . APP_DIR . DS);
