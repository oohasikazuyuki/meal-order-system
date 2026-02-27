<?php
namespace App\Controller\Api;

use App\Controller\AppController;

/**
 * グラム量設定 API
 *
 * POST /api/room-gram-settings/upsert.json
 * {
 *   "room_id": 1,
 *   "items": [
 *     {"meal_type": 1, "grams_per_person": 200.0},
 *     {"meal_type": 2, "grams_per_person": 350.0},
 *     ...
 *   ]
 * }
 */
class RoomGramSettingsController extends AppController
{
    /** POST /api/room-gram-settings/upsert.json - room_id の全meal_typeをupsert */
    public function upsert(): void
    {
        $data   = $this->request->getData();
        $roomId = (int)($data['room_id'] ?? 0);
        $items  = $data['items'] ?? [];

        if (!$roomId || empty($items) || !is_array($items)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'room_id と items が必要です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $table  = $this->fetchTable('RoomGramSettings');
        $saved  = [];
        $errors = [];

        foreach ($items as $item) {
            $mealType = (int)($item['meal_type'] ?? 0);
            if (!in_array($mealType, [1, 2, 3, 4], true)) {
                continue;
            }

            $existing = $table->find()
                ->where(['room_id' => $roomId, 'meal_type' => $mealType])
                ->first();

            $entity = $existing
                ? $table->patchEntity($existing, ['grams_per_person' => $item['grams_per_person'] ?? 0])
                : $table->newEntity([
                    'room_id'          => $roomId,
                    'meal_type'        => $mealType,
                    'grams_per_person' => $item['grams_per_person'] ?? 0,
                ]);

            if ($table->save($entity)) {
                $saved[] = $entity;
            } else {
                $errors[$mealType] = $entity->getErrors();
            }
        }

        if (!empty($errors)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $errors]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'errors']);
            return;
        }

        $this->set(['ok' => true, 'saved' => $saved]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'saved']);
    }
}
