<?php
return [
    'debug' => filter_var(getenv('DEBUG') ?: true, FILTER_VALIDATE_BOOLEAN),
    'Security' => [
        'salt' => getenv('SECURITY_SALT') ?: 'meal-order-default-salt-change-me',
    ],
    'Datasources' => [
        'default' => [
            'host' => getenv('DB_HOST') ?: 'db',
            'username' => getenv('DB_USER') ?: 'cake_user',
            'password' => getenv('DB_PASS') ?: 'secret',
            'database' => getenv('DB_NAME') ?: 'meal_order_db',
        ],
    ],
];
