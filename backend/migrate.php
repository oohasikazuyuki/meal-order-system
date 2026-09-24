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
