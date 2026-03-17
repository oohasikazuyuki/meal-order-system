<?php
declare(strict_types=1);

namespace App\Application\Exception;

/**
 * 入力値エラー例外
 */
class InputValidationException extends ApplicationException
{
    private array $errors = [];

    public function __construct(array $errors = [], string $message = 'バリデーションエラー')
    {
        parent::__construct($message, 400);
        $this->errors = $errors;
    }

    public function getErrors(): array
    {
        return $this->errors;
    }
}
