<?php
namespace App\Controller;

use Cake\Controller\Controller;
use Cake\Event\EventInterface;

class AppController extends Controller
{
    public function initialize(): void
    {
        parent::initialize();
    }

    public function beforeRender(EventInterface $event): void
    {
        parent::beforeRender($event);
        // .json 拡張子または Accept: application/json の場合に JsonView を使用
        if (
            $this->request->getParam('_ext') === 'json'
            || str_contains($this->request->getHeaderLine('Accept'), 'application/json')
        ) {
            $this->viewBuilder()->setClassName('Cake\View\JsonView');
        }
    }
}
