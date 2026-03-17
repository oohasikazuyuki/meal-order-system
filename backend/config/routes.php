<?php
use Cake\Routing\Route\DashedRoute;
use Cake\Routing\RouteBuilder;

return static function (RouteBuilder $routes): void {
    $routes->setRouteClass(DashedRoute::class);

    $routes->prefix('Api', function (RouteBuilder $routes): void {
        $routes->setExtensions(['json']);

        $routes->resources('Orders', [
            'only' => ['index', 'create', 'update', 'delete'],
            'map'  => [
                'summary' => [
                    'action' => 'summary',
                    'method' => 'GET',
                    'path'   => 'summary',
                ],
            ],
        ]);

        $routes->connect('/menus/copy-routine', ['controller' => 'Menus', 'action' => 'copyRoutine'], ['_method' => 'POST']);
        $routes->resources('Menus', ['only' => ['index', 'create', 'delete']]);

        $routes->resources('OrderQuantities', ['only' => ['index', 'create', 'delete']]);

        $routes->connect('/auth/login',  ['controller' => 'Auth', 'action' => 'login'],  ['_name' => 'auth_login',  '_method' => 'POST']);
        $routes->connect('/auth/logout', ['controller' => 'Auth', 'action' => 'logout'], ['_name' => 'auth_logout', '_method' => 'POST']);
        $routes->connect('/auth/me',     ['controller' => 'Auth', 'action' => 'me'],     ['_name' => 'auth_me',     '_method' => 'GET']);

        $routes->resources('Users', ['only' => ['index', 'create', 'update', 'delete']]);

        // 部屋: kamaho同期カスタムルートを先に定義
        $routes->connect('/rooms/sync-kamaho', ['controller' => 'Rooms', 'action' => 'syncKamaho'], ['_method' => 'POST']);
        $routes->resources('Rooms', ['only' => ['index', 'create', 'delete']]);

        $routes->resources('Blocks', ['only' => ['index', 'create', 'delete']]);

        $routes->resources('BlockOrderQuantities', ['only' => ['index', 'create']]);

        $routes->resources('MenuIngredients', ['only' => ['index', 'create']]);

        $routes->resources('MenuMasters', ['only' => ['index', 'create', 'update', 'delete']]);

        $routes->resources('Suppliers', ['only' => ['index', 'create', 'update', 'delete']]);

        $routes->connect('/order-sheets/calculate',  ['controller' => 'OrderSheets', 'action' => 'calculate'],  ['_method' => 'GET']);
        $routes->connect('/order-sheets/inventory',  ['controller' => 'OrderSheets', 'action' => 'inventory'],  ['_method' => 'GET']);
        $routes->connect('/order-sheets/download',  ['controller' => 'OrderSheets', 'action' => 'download'],  ['_method' => ['GET', 'POST']]);
        $routes->connect('/order-sheets/pdf',       ['controller' => 'OrderSheets', 'action' => 'pdf'],       ['_method' => ['GET', 'POST']]);

        $routes->resources('OrderSheetLogs', ['only' => ['index']]);

        // 生協発注
        $routes->connect('/coop-orders/items', ['controller' => 'CoopOrders', 'action' => 'items'], ['_method' => 'GET']);
        $routes->resources('CoopOrders', ['only' => ['index', 'create']]);

        $routes->connect('/menu-table/excel', ['controller' => 'MenuTable', 'action' => 'excel'], ['_method' => 'GET']);
        $routes->connect('/menu-table/pdf',   ['controller' => 'MenuTable', 'action' => 'pdf'],   ['_method' => 'GET']);
        $routes->connect('/menu-table',       ['controller' => 'MenuTable', 'action' => 'index'], ['_method' => 'GET']);
        $routes->connect('/ai/menu-suggest',  ['controller' => 'Ai', 'action' => 'menuSuggest'], ['_method' => 'POST']);
        $routes->connect('/ai/menu-master-draft', ['controller' => 'Ai', 'action' => 'menuMasterDraft'], ['_method' => 'POST']);

        $routes->connect(
            '/kamaho-meal-counts',
            ['controller' => 'KamahoMealCounts', 'action' => 'index']
        );
    });
};
