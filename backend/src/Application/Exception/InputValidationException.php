<?php
declare(strict_types=1);

namespace App\Application\Exception;

/**
 * 入力値エラー例外
 */
class InputValidationException extends ApplicationException
{
    private array $errors = [];

    public function __construct(
        array $errors = [],
        string $message = 'バリデーションエラー',
        string $errorCode = ErrorCode::COMMON_VALIDATION
    )
    {
        parent::__construct($message, 400, $errorCode, $errors);
        $this->errors = $errors;
    }

    public function getErrors(): array
    {
        return $this->errors;
    }
}