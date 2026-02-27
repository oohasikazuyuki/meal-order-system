<?php
declare(strict_types=1);

/*
 * CakePHP entry point
 */

if (!defined('DS')) {
    define('DS', DIRECTORY_SEPARATOR);
}

define('ROOT', dirname(__DIR__));
define('APP_DIR', 'src');
define('WEBROOT_DIR', 'webroot');
define('WWW_ROOT', __DIR__ . DS);
define('CONFIG', ROOT . DS . 'config' . DS);
define('APP', ROOT . DS . APP_DIR . DS);
define('CACHE', ROOT . DS . 'tmp' . DS . 'cache' . DS);
define('LOGS', ROOT . DS . 'logs' . DS);
define('TMP', ROOT . DS . 'tmp' . DS);
define('RESOURCES', ROOT . DS . 'resources' . DS);
define('TESTS', ROOT . DS . 'tests' . DS);
define('CORE_PATH', ROOT . DS . 'vendor' . DS . 'cakephp' . DS . 'cakephp' . DS);

require ROOT . DS . 'vendor' . DS . 'autoload.php';

use App\Application;
use Cake\Http\Server;

// Bind your application to the server.
$server = new Server(new Application(CONFIG));

// Run the request and emit the response.
$server->emit($server->run());
