<?php
declare(strict_types=1);

namespace App\Domain\Exception;

/**
 * ビジネスルール違反例外
 */
class BusinessRuleViolationException extends DomainException
{
    public function __construct(string $message = 'ビジネスルール違反です', ?\Throwable $previous = null)
    {
        parent::__construct($message, 422, $previous);
    }
}
