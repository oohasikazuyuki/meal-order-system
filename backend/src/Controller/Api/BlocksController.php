<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use Cake\Datasource\Exception\RecordNotFoundException;
use Cake\Database\Exception\DatabaseException;

class BlocksController extends AppController
{
    public function initialize(): void
    {
        parent::initialize();
        $this->Blocks = $this->fetchTable('Blocks');
    }

    /** GET /api/blocks.json - ブロック一覧（部屋+グラム設定含む） */
    public function index(): void
    {
        $blocks = $this->Blocks->find('all')
            ->contain(['Room1', 'Room2'])
            ->orderBy(['Blocks.sort_order' => 'ASC', 'Blocks.id' => 'ASC'])
            ->toArray();

        $this->set(['ok' => true, 'blocks' => $blocks]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'blocks']);
    }

    /** POST /api/blocks.json */
    public function add(): void
    {
        $data = (array)$this->request->getData();

        // フロント/外部クライアントの camelCase を許容する
        if (!array_key_exists('room1_id', $data) && array_key_exists('room1Id', $data)) {
            $data['room1_id'] = $data['room1Id'];
        }
        if (!array_key_exists('room2_id', $data) && array_key_exists('room2Id', $data)) {
            $data['room2_id'] = $data['room2Id'];
        }

        if (array_key_exists('room1_id', $data)) {
            $data['room1_id'] = (int)$data['room1_id'];
        }
        if (array_key_exists('room2_id', $data)) {
            $data['room2_id'] = (int)$data['room2_id'];
        }

        if (
            empty($data['name']) ||
            empty($data['room1_id']) ||
            empty($data['room2_id'])
        ) {
            $this->response = $this->response->withStatus(400);
            $this->set([
                'ok' => false,
                'errors' => [
                    'message' => 'ブロック名・部屋1・部屋2は必須です',
                ],
            ]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'errors']);
            return;
        }

        $entity = $this->Blocks->newEntity($data);

        if ($this->Blocks->save($entity)) {
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
        try {
            $entity = $this->Blocks->get($id);
            if (!$this->Blocks->delete($entity)) {
                $this->response = $this->response->withStatus(400);
                $this->set(['ok' => false, 'message' => 'ブロックの削除に失敗しました']);
                $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
                return;
            }

            $this->set(['ok' => true]);
            $this->viewBuilder()->setOption('serialize', ['ok']);
        } catch (RecordNotFoundException $e) {
            $this->response = $this->response->withStatus(404);
            $this->set(['ok' => false, 'message' => 'ブロックが見つかりません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
        } catch (DatabaseException $e) {
            $this->response = $this->response->withStatus(409);
            $this->set(['ok' => false, 'message' => '関連データがあるため削除できません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
        }
    }
}
