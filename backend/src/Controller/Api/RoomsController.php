<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Service\KamahoApiService;

class RoomsController extends AppController
{
    public function initialize(): void
    {
        parent::initialize();
        $this->Rooms = $this->fetchTable('Rooms');
    }

    /** GET /api/rooms.json */
    public function index(): void
    {
        $rooms = $this->Rooms->find('all')
            ->orderBy(['sort_order' => 'ASC', 'id' => 'ASC'])
            ->toArray();

        $this->set(['ok' => true, 'rooms' => $rooms]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'rooms']);
    }

    /** POST /api/rooms.json */
    public function add(): void
    {
        $entity = $this->Rooms->newEntity($this->request->getData());

        if ($this->Rooms->save($entity)) {
            $this->response = $this->response->withStatus(201);
            $this->set(['ok' => true, 'room' => $entity]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $entity->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'room', 'errors']);
    }

    /** DELETE /api/rooms/:id.json */
    public function delete(int $id): void
    {
        $entity = $this->Rooms->get($id);
        $this->Rooms->delete($entity);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }

    /**
     * POST /api/rooms/sync-kamaho.json
     * kamaho の部屋一覧を取り込む（部屋IDで対応付け、未登録の部屋は追加）
     */
    public function syncKamaho(): void
    {
        $user = $this->requireAuthenticatedUser();
        if ($user === null) {
            return;
        }
        try {
            $kamahoRooms = (new KamahoApiService())->getRooms();
        } catch (\RuntimeException $e) {
            $this->response = $this->response->withStatus(502);
            $this->set(['ok' => false, 'message' => $e->getMessage()]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $added = $this->Rooms->syncKamahoRooms($kamahoRooms);
        $kamahoNames = array_values($kamahoRooms);

        $rooms = $this->Rooms->find('all')->orderBy(['sort_order' => 'ASC', 'id' => 'ASC'])->toArray();
        $this->set(['ok' => true, 'added' => $added, 'rooms' => $rooms, 'kamaho_rooms' => $kamahoNames]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'added', 'rooms', 'kamaho_rooms']);
    }
}
