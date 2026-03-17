<?php
declare(strict_types=1);

namespace App\Domain\Exception;

/**
 * エンティティ未検出例外
 */
class EntityNotFoundException extends DomainException
{
    public function __construct(string $entityType = 'Entity', int $id = 0)
    {
        $message = "{$entityType} (ID: {$id}) が見つかりません";
        parent::__construct($message, 404);
    }
}
