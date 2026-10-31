<?php
declare(strict_types=1);

use Cake\Core\Configure;
use Cake\Datasource\ConnectionManager;
use Cake\TestSuite\ConnectionHelper;

require dirname(__DIR__) . '/config/paths.php';
require ROOT . DS . 'vendor' . DS . 'autoload.php';

foreach ([CACHE . 'models', CACHE . 'persistent', LOGS] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

Configure::write('App.namespace', 'App');
require CONFIG . 'bootstrap.php';

// 手元で別ポートのMySQLを使うとき用（CIは3306のまま）
if (getenv('DB_PORT')) {
    $config = ConnectionManager::getConfig('test');
    ConnectionManager::drop('test');
    ConnectionManager::setConfig('test', ['port' => getenv('DB_PORT')] + $config);
}

// アプリの 'default' 接続をテスト用DB（DB_NAME + '_test'）に向ける。
// 実際に接続するのはDBに触るテストだけ
ConnectionHelper::addTestAliases();
