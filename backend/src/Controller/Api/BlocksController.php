<?php
namespace App\Controller\Api;

use App\Controller\AppController;

class BlocksController extends AppController
{
    /** GET /api/blocks.json - ブロック一覧（部屋+グラム設定含む） */
    public function index(): void
    {
        $table  = $this->fetchTable('Blocks');
        $blocks = $table->find('all')
            ->contain(['Room1', 'Room2'])
            ->orderBy(['Blocks.sort_order' => 'ASC', 'Blocks.id' => 'ASC'])
            ->toArray();

        $this->set(['ok' => true, 'blocks' => $blocks]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'blocks']);
    }

    /** POST /api/blocks.json */
    public function add(): void
    {
        $table  = $this->fetchTable('Blocks');
        $entity = $table->newEntity($this->request->getData());

        if ($table->save($entity)) {
            $this->response = $this->response->withStatus(201);
            $this->set(['ok' => true, 'block' => $entity]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $entity->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'block', 'errors']);
    }

    /** DELETE /api/blocks/:id.json */
    public function delete(int $id): void
    {
        $table  = $this->fetchTable('Blocks');
        $entity = $table->get($id);
        $table->delete($entity);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }
}
