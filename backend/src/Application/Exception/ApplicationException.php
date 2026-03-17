<?php
declare(strict_types=1);

namespace App\Application\Exception;

/**
 * アプリケーション例外の基底クラス
 */
class ApplicationException extends \Exception
{
    public function __construct(string $message = '', int $code = 400, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
