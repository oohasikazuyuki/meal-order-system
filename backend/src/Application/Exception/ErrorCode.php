<?php
declare(strict_types=1);

namespace App\Application\Exception;

/**
 * APIエラーコード定義
 */
final class ErrorCode
{
    public const COMMON_VALIDATION = 'COMMON-VALIDATION-001';
    public const COMMON_AUTH_REQUIRED = 'COMMON-AUTH-001';
    public const COMMON_AUTH_INVALID = 'COMMON-AUTH-002';
    public const COMMON_AUTHZ = 'COMMON-AUTHZ-001';
    public const COMMON_NOT_FOUND = 'COMMON-NOTFOUND-001';
    public const COMMON_CONFLICT = 'COMMON-CONFLICT-001';
    public const COMMON_INTERNAL = 'COMMON-INTERNAL-001';

    public const ORDER_VALIDATION_DATE = 'ORDER-VALIDATION-001';
    public const ORDER_VALIDATION_QUANTITY = 'ORDER-VALIDATION-002';
    public const ORDER_DUPLICATE = 'ORDER-DUPLICATE-001';
    public const ORDER_STATE_NOT_EDITABLE = 'ORDER-STATE-001';
    public const ORDER_STATE_NOT_CANCELLABLE = 'ORDER-STATE-002';

    public const MENU_VALIDATION = 'MENU-VALIDATION-001';
    public const AI_PARSE = 'AI-PARSE-001';
    public const SUPPLIER_NOT_FOUND = 'SUPPLIER-NOTFOUND-001';

    private function __construct()
    {
    }
}