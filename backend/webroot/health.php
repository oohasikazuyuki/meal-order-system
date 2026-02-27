<?php
// シンプルな疎通確認エンドポイント（/health.php）
header('Content-Type: application/json');
echo json_encode([
    'ok'  => true,
    'php' => PHP_VERSION,
    'now' => date('Y-m-d H:i:s'),
]);
