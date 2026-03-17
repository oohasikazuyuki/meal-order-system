<?php
namespace App\View;

use Cake\View\JsonView as CakeJsonView;

class JsonView extends CakeJsonView
{
    /**
     * JSON をレンダリング（UTF-8対応）
     */
    public function render(?string $template = null, string|false|null $layout = null): string
    {
        // jsonOptions 設定を読み込む
        $jsonOptions = $this->getConfig('jsonOptions') ?? 0;
        
        // JSON_UNESCAPED_UNICODEを強制的に追加
        $jsonOptions |= JSON_UNESCAPED_UNICODE;
        
        // これをビューに一時的に保存
        $this->set('_jsonOptions', $jsonOptions);
        
        // 親クラスのrenderを呼び出す前に、直接処理
        if ($this->getConfig('serialize')) {
            $result = [];
            foreach ((array)$this->getConfig('serialize') as $var) {
                if (isset($this->viewVars[$var])) {
                    $result[$var] = $this->viewVars[$var];
                }
            }
            return json_encode($result, $jsonOptions);
        }
        
        return parent::render($template, $layout);
    }
}
