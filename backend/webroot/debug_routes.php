<?php
ini_set('display_errors', '1');
error_reporting(E_ALL);

define('DS', DIRECTORY_SEPARATOR);
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

require ROOT . '/vendor/autoload.php';

header('Content-Type: text/plain');

use Cake\Routing\Router;
use Cake\Routing\RouteBuilder;

try {
    require CONFIG . 'bootstrap.php';
    echo "1. bootstrap OK\n";
} catch (Throwable $e) {
    echo "bootstrap ERROR: " . $e->getMessage() . "\n";
    exit;
}

try {
    // RoutingMiddleware と同じ手順で Router を初期化
    Router::reload();
    echo "2. Router::reload() OK\n";
} catch (Throwable $e) {
    echo "Router::reload() ERROR: " . $e->getMessage() . "\n";
    exit;
}

try {
    $app = new App\Application(CONFIG);
    $builder = Router::createRouteBuilder('/');
    $app->routes($builder);
    echo "3. routes loaded OK\n";
    echo "   Route count: " . count(Router::routes()->routes()) . "\n";

    // ルートリスト表示
    foreach (Router::routes()->routes() as $route) {
        echo "   " . $route->template . " -> " . json_encode($route->defaults) . "\n";
    }
} catch (Throwable $e) {
    echo "routes ERROR: " . $e->getMessage() . "\n";
    echo "  file: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo $e->getTraceAsString() . "\n";
}
