<?php
namespace App\Service;

use RuntimeException;

/**
 * 保存済みの資格情報を復号できなかったとき。
 *
 * 通信失敗など他の異常と区別するために独立させている。
 * これが出たら利用者に再連携を促すこと。復号できない資格情報は
 * 何度試しても復号できないので、再試行を促しても意味がない。
 */
class CredentialDecryptionException extends RuntimeException
{
}
