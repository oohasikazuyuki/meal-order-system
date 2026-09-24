<?php
namespace App\Service;

use Cake\Utility\Security;
use RuntimeException;

/**
 * 外部システムの資格情報を、DBに保存できる形に暗号化する。
 *
 * CakePHP の Security::encrypt() を使う。AES-256-CBC に HMAC-SHA256 が付くため、
 * 暗号文の改ざんを検知できる。自前で AES を組むと、この認証部分が抜けやすい。
 *
 * 鍵は Security::getSalt() から導く。Configure::read('Security.salt') は使えない。
 * config/bootstrap.php が Configure::consume() で読み出しており、
 * 読んだ時点でキーが消えるため、あとから read すると常に null になる。
 * null から導いた鍵は sha256('') という全環境共通の固定値になり、
 * DBが1つ漏れれば保存済みの資格情報がすべて復号できてしまう。
 */
class CredentialCryptoService
{
    public function encrypt(string $plainText): string
    {
        return base64_encode(Security::encrypt($plainText, $this->key()));
    }

    /**
     * @throws CredentialDecryptionException 復号できないとき。
     *   鍵（SECURITY_SALT）が変わった場合もここに来る。呼び出し側で捕まえて、
     *   利用者に再連携を促すこと。黙って空文字を返すと、資格情報なしのまま
     *   外部システムを叩いて原因の分からない失敗になる。
     */
    public function decrypt(string $encryptedText): string
    {
        $raw = base64_decode($encryptedText, true);
        if ($raw === false || $raw === '') {
            throw new CredentialDecryptionException('資格情報の復号に失敗しました');
        }

        $plainText = Security::decrypt($raw, $this->key());
        if ($plainText === null) {
            throw new CredentialDecryptionException('資格情報の復号に失敗しました');
        }

        return $plainText;
    }

    /**
     * Security::encrypt は32バイト以上の鍵を要求する。
     * salt の長さに関係なく満たせるよう、ハッシュを通してから渡す。
     */
    private function key(): string
    {
        $salt = (string)Security::getSalt();
        if ($salt === '') {
            throw new RuntimeException(
                'SECURITY_SALT が設定されていません。資格情報を暗号化できません。'
            );
        }
        return hash('sha256', $salt);
    }
}
