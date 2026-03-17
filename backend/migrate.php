<?php
require '/var/www/html/vendor/autoload.php';

use Cake\Core\Configure;
use Cake\Datasource\ConnectionManager;

// CakePHPの設定を読み込む
Configure::write('App.namespace', 'App');
Configure::write('debug', true);

// データベース接続を初期化
ConnectionManager::setConfig('default', [
    'className' => 'Cake\Database\Connection',
    'driver' => 'Cake\Database\Driver\Mysql',
    'persistent' => false,
    'host' => 'db',
    'username' => 'cake_user',
    'password' => 'secret',
    'database' => 'meal_order_db',
    'encoding' => 'utf8mb4',
    'timezone' => 'UTC',
    'cacheMetadata' => true,
    'quoteIdentifiers' => true,
    'log' => false,
]);

// Phinxを使用してマイグレーションを実行
$app = require '/var/www/html/config/bootstrap.php';
