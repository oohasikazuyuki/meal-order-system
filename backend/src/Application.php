<?php
namespace App;

use Cake\Core\Configure;
use Cake\Error\Middleware\ErrorHandlerMiddleware;
use Cake\Http\BaseApplication;
use Cake\Http\Middleware\BodyParserMiddleware;
use Cake\Http\MiddlewareQueue;
use Cake\Routing\Middleware\AssetMiddleware;
use Cake\Routing\Middleware\RoutingMiddleware;
use Cake\Routing\Router;

class Application extends BaseApplication
{
    public function bootstrap(): void
    {
        parent::bootstrap();
        // CakePHP 5.3 では RoutingMiddleware が Router::reload() を呼ばないため
        // ここで明示的に初期化する
        Router::reload();
    }

    public function middleware(MiddlewareQueue $middlewareQueue): MiddlewareQueue
    {
        $middlewareQueue
            ->add(new ErrorHandlerMiddleware(Configure::read('Error'), $this))
            ->add(new AssetMiddleware(['cacheTime' => Configure::read('Asset.cacheTime')]))
            ->add(new RoutingMiddleware($this))
            ->add(new BodyParserMiddleware());

        return $middlewareQueue;
    }
}
