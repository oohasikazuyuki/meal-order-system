<?php
namespace App\Service;

use App\Repository\BirthdayMenuDateRepository;

class BirthdayMenuDateService
{
    private BirthdayMenuDateRepository $repository;

    public function __construct()
    {
        $this->repository = new BirthdayMenuDateRepository();
    }

    public function getByMonth(int $year, int $month, ?int $blockId): array
    {
        return $this->repository->findByMonthAndBlock($year, $month, $blockId);
    }

    public function save(array $data): array
    {
        $menuDate = $data['menu_date'] ?? null;
        $blockId  = isset($data['block_id']) && $data['block_id'] !== '' ? (int)$data['block_id'] : null;

        $existing = $this->repository->findByDateAndBlock((string)$menuDate, $blockId);
        $entity   = $existing
            ? $this->repository->patch($existing, $data)
            : $this->repository->create($data);

        $success = $this->repository->save($entity);

        return [
            'success' => $success,
            'status'  => $success ? ($existing ? 200 : 201) : 400,
            'birthday_menu_date' => $success ? $entity : null,
            'errors'  => $success ? [] : $entity->getErrors(),
        ];
    }

    public function update(int $id, array $data): array
    {
        $entity  = $this->repository->get($id);
        $entity  = $this->repository->patch($entity, $data);
        $success = $this->repository->save($entity);

        return [
            'success' => $success,
            'status'  => $success ? 200 : 400,
            'birthday_menu_date' => $success ? $entity : null,
            'errors'  => $success ? [] : $entity->getErrors(),
        ];
    }

    public function delete(int $id): bool
    {
        $entity = $this->repository->get($id);
        return $this->repository->delete($entity);
    }
}
