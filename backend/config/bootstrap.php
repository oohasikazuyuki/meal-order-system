<?php
use Cake\Cache\Cache;
use Cake\Core\Configure;
use Cake\Core\Configure\Engine\PhpConfig;
use Cake\Datasource\ConnectionManager;
use Cake\Log\Log;
use Cake\Utility\Security;

// 設定ファイルの読み込み
try {
    Configure::config('default', new PhpConfig());
    Configure::load('app', 'default', false);
} catch (\Exception $e) {
    exit($e->getMessage() . "\n");
}

// ローカル設定で上書き（DB 接続情報など）
Configure::load('app_local', 'default');

// タイムゾーン・エンコーディング
date_default_timezone_set(Configure::read('App.defaultTimezone'));
mb_internal_encoding(Configure::read('App.encoding'));
ini_set('intl.default_locale', Configure::read('App.defaultLocale'));

// キャッシュ・DB・ログ・セキュリティキーの設定を適用
Cache::setConfig(Configure::consume('Cache'));
ConnectionManager::setConfig(Configure::consume('Datasources'));
Log::setConfig(Configure::consume('Log'));
Security::setSalt(Configure::consume('Security.salt'));
