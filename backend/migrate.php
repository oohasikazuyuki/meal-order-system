<?php
declare(strict_types=1);

require __DIR__ . '/config/paths.php';
require __DIR__ . '/vendor/autoload.php';

use Cake\Core\Configure;
use Migrations\Migrations;

Configure::write('App.namespace', 'App');
require __DIR__ . '/config/bootstrap.php';

$migrations = new Migrations();
foreach ($migrations->status() as $row) {
    printf("%-10s %s %s\n", $row['status'], $row['id'], $row['name']);
}

$migrations->migrate();
echo "migrated\n";

// 列を足すマイグレーションのあと、キャッシュ済みのテーブル定義に新しい列が無いままだと
// API が既存の列だけを返し続ける。値はDBに入っているのに画面に出ない、という
// 原因の分かりにくい壊れ方をするので、マイグレーションとセットで捨てる。
$modelCacheDir = __DIR__ . '/tmp/cache/models';
$cleared = 0;
foreach (glob($modelCacheDir . '/*') ?: [] as $file) {
    if (is_file($file) && @unlink($file)) {
        $cleared++;
    }
}
echo "model cache cleared ({$cleared} files)\n";
