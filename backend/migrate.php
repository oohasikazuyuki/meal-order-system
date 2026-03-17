<?php
require __DIR__ . '/vendor/autoload.php';

use Cake\Core\Configure;
use Cake\Datasource\ConnectionManager;

// CakePHPの設定を読み込む
Configure::write('App.namespace', 'App');
Configure::write('debug', true);

// データベース接続を初期化（環境変数優先）
ConnectionManager::setConfig('default', [
    'className' => 'Cake\Database\Connection',
    'driver' => 'Cake\Database\Driver\Mysql',
    'persistent' => false,
    'host' => getenv('DB_HOST') ?: 'db',
    'username' => getenv('DB_USER') ?: 'cake_user',
    'password' => getenv('DB_PASS') ?: 'secret',
    'database' => getenv('DB_NAME') ?: 'meal_order_db',
    'encoding' => 'utf8mb4',
    'timezone' => 'UTC',
    'cacheMetadata' => true,
    'quoteIdentifiers' => true,
    'log' => false,
]);

// Phinxを使用してマイグレーションを実行
$app = require __DIR__ . '/config/bootstrap.php';
