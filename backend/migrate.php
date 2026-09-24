<?php
require __DIR__ . '/vendor/autoload.php';

use Cake\Datasource\ConnectionManager;
use Migrations\CakeAdapter;
use Phinx\Config\Config;
use Phinx\Migration\Manager;
use Symfony\Component\Console\Input\StringInput;
use Symfony\Component\Console\Output\StreamOutput;

// PhpConfig が使う CONFIG 定数を定義（bootstrap.php より前に定義必須）
if (!defined('CONFIG')) {
    define('CONFIG', __DIR__ . '/config/');
}
if (!defined('ROOT')) {
    define('ROOT', dirname(__DIR__));
}
if (!defined('APP')) {
    define('APP', __DIR__ . '/src/');
}
if (!defined('WWW_ROOT')) {
    define('WWW_ROOT', __DIR__ . '/webroot/');
}
if (!defined('LOGS')) {
    define('LOGS', __DIR__ . '/logs/');
}
if (!defined('TMP')) {
    define('TMP', __DIR__ . '/tmp/');
}
if (!defined('CACHE')) {
    define('CACHE', TMP . 'cache/');
}

// CakePHP bootstrap（DB接続・設定ロード）
require __DIR__ . '/config/bootstrap.php';

// Phinx 設定を動的に生成
$dbConfig = ConnectionManager::getConfig('default');
$phinxConfig = new Config([
    'paths' => [
        'migrations' => __DIR__ . '/config/Migrations',
    ],
    'environments' => [
        'default_migration_table' => 'phinxlog',
        'default_environment'     => 'default',
        'default' => [
            'adapter'  => 'mysql',
            'host'     => $dbConfig['host'],
            'name'     => $dbConfig['database'],
            'user'     => $dbConfig['username'],
            'pass'     => $dbConfig['password'],
            'port'     => $dbConfig['port'] ?? 3306,
            'charset'  => 'utf8mb4',
        ],
    ],
]);

$input  = new StringInput('');
$output = new StreamOutput(fopen('php://stdout', 'w'));
$manager = new Manager($phinxConfig, $input, $output);
$manager->migrate('default');
echo "\nMigration completed.\n";
