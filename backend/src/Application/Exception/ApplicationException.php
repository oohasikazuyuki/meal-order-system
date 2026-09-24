<?php
declare(strict_types=1);

namespace App\Application\Exception;

/**
 * アプリケーション例外の基底クラス
 */
class ApplicationException extends \Exception
{
    private string $errorCode;
    private array $details;

    public function __construct(
        string $message = '',
        int $httpStatus = 400,
        string $errorCode = ErrorCode::COMMON_VALIDATION,
        array $details = [],
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $httpStatus, $previous);
        $this->errorCode = $errorCode;
        $this->details = $details;
    }

    public function getHttpStatus(): int
    {
        return (int)$this->getCode();
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getDetails(): array
    {
        return $this->details;
    }
}