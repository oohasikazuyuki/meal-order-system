<?php
namespace App\Service;

use Cake\Core\Configure;

class CredentialCryptoService
{
    public function encrypt(string $plainText): string
    {
        $key = hash('sha256', (string)Configure::read('Security.salt'), true);
        $iv = random_bytes(16);
        $cipherText = openssl_encrypt($plainText, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        if ($cipherText === false) {
            throw new \RuntimeException('資格情報の暗号化に失敗しました');
        }
        return base64_encode($iv . $cipherText);
    }

    public function decrypt(string $encryptedText): string
    {
        $raw = base64_decode($encryptedText, true);
        if ($raw === false || strlen($raw) <= 16) {
            throw new \RuntimeException('資格情報の復号に失敗しました');
        }

        $iv = substr($raw, 0, 16);
        $cipherText = substr($raw, 16);
        $key = hash('sha256', (string)Configure::read('Security.salt'), true);
        $plainText = openssl_decrypt($cipherText, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        if ($plainText === false) {
            throw new \RuntimeException('資格情報の復号に失敗しました');
        }

        return $plainText;
    }
}
