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

        $routes->resources('Menus', ['only' => ['index', 'create', 'delete']]);

        $routes->resources('OrderQuantities', ['only' => ['index', 'create']]);

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

        $routes->connect(
            '/kamaho-meal-counts',
            ['controller' => 'KamahoMealCounts', 'action' => 'index']
        );
    });
};
