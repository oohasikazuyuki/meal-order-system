<?php
namespace App\Controller\Api;

use App\Controller\AppController;

/**
 * 仕入先マスタ API
 * GET    /api/suppliers.json
 * POST   /api/suppliers.json
 * PUT    /api/suppliers/:id.json
 * DELETE /api/suppliers/:id.json
 *
 * テンプレート操作
 * POST   /api/suppliers/:id/template   — アップロード
 * DELETE /api/suppliers/:id/template   — 削除（デフォルトに戻す）
 * GET    /api/suppliers/:id/template   — ダウンロード
 */
class SuppliersController extends AppController
{
    private const UPLOAD_DIR = APP . '../../resources/uploaded_templates/';
    private const MAX_SIZE   = 10 * 1024 * 1024; // 10MB
    private const ALLOW_EXT  = ['xlsx', 'xlsm'];

    public function initialize(): void
    {
        parent::initialize();
        $this->Suppliers = $this->fetchTable('Suppliers');
    }

    public function index(): void
    {
        $suppliers = $this->Suppliers->find()
            ->orderBy(['id' => 'ASC'])
            ->toArray();

        $result = array_map(function ($s) {
            $arr = $s->toArray();
            $arr['has_custom_template'] = $this->hasCustomTemplate((int)$s->id, (string)$s->file_ext);
            return $arr;
        }, $suppliers);

        $this->set(['ok' => true, 'suppliers' => $result]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'suppliers']);
    }

    public function add(): void
    {
        $data     = $this->request->getData();
        $supplier = $this->Suppliers->newEntity($data);

        if ($this->Suppliers->save($supplier)) {
            $this->response = $this->response->withStatus(201);
            $arr = $supplier->toArray();
            $arr['has_custom_template'] = false;
            $this->set(['ok' => true, 'supplier' => $arr]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $supplier->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'supplier', 'errors']);
    }

    public function edit(int $id): void
    {
        $supplier = $this->Suppliers->get($id);
        $this->Suppliers->patchEntity($supplier, $this->request->getData());

        if ($this->Suppliers->save($supplier)) {
            $arr = $supplier->toArray();
            $arr['has_custom_template'] = $this->hasCustomTemplate($id, (string)$supplier->file_ext);
            $this->set(['ok' => true, 'supplier' => $arr]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $supplier->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'supplier', 'errors']);
    }

    public function delete(int $id): void
    {
        $supplier = $this->Suppliers->get($id);
        $this->deleteTemplateFile($id, (string)$supplier->file_ext);
        $this->Suppliers->delete($supplier);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }

    // ----------------------------------------
    // テンプレート操作
    // ----------------------------------------

    /** POST /api/suppliers/:id/template — multipart/form-data でテンプレートをアップロード */
    public function uploadTemplate(int $id): void
    {
        $supplier = $this->Suppliers->get($id);
        $file = $this->request->getUploadedFile('template');

        if (!$file) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'template フィールドにファイルを指定してください']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        // ファイルサイズ検証
        if ($file->getSize() > self::MAX_SIZE) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'ファイルサイズは10MB以下にしてください']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        // 拡張子検証
        $originalName = $file->getClientFilename() ?? '';
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($ext, self::ALLOW_EXT, true)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'xlsx または xlsm ファイルのみアップロードできます']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        // MIMEタイプ検証（xlsx/xlsm の MIME）
        $allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel.sheet.macroenabled.12',
            'application/octet-stream', // 一部ブラウザが送るフォールバック
        ];
        $mime = $file->getClientMediaType() ?? '';
        if (!in_array($mime, $allowedMimes, true)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => '不正なファイル形式です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        // 既存テンプレートを削除してから保存
        $this->deleteTemplateFile($id, (string)$supplier->file_ext);
        $destPath = self::UPLOAD_DIR . $id . '.' . $ext;

        if (!is_dir(self::UPLOAD_DIR)) {
            mkdir(self::UPLOAD_DIR, 0755, true);
        }

        $file->moveTo($destPath);

        // file_ext を更新（アップロードされた拡張子に合わせる）
        if ($supplier->file_ext !== $ext) {
            $this->Suppliers->patchEntity($supplier, ['file_ext' => $ext]);
            $this->Suppliers->save($supplier);
        }

        $this->set([
            'ok'                  => true,
            'message'             => 'テンプレートをアップロードしました',
            'has_custom_template' => true,
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'message', 'has_custom_template']);
    }

    /** DELETE /api/suppliers/:id/template — アップロード済みテンプレートを削除してデフォルトに戻す */
    public function deleteTemplate(int $id): void
    {
        $supplier = $this->Suppliers->get($id);
        $deleted  = $this->deleteTemplateFile($id, (string)$supplier->file_ext);

        if (!$deleted) {
            $this->response = $this->response->withStatus(404);
            $this->set(['ok' => false, 'message' => 'カスタムテンプレートが存在しません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $this->set([
            'ok'                  => true,
            'message'             => 'カスタムテンプレートを削除しデフォルトに戻しました',
            'has_custom_template' => false,
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'message', 'has_custom_template']);
    }

    /** GET /api/suppliers/:id/template — 現在のテンプレートをダウンロード */
    public function downloadTemplate(int $id): void
    {
        $supplier   = $this->Suppliers->get($id);
        $ext        = (string)$supplier->file_ext;
        $customPath = self::UPLOAD_DIR . $id . '.' . $ext;

        if (file_exists($customPath)) {
            $filePath = $customPath;
            $fileName = $supplier->name . '_template.' . $ext;
        } else {
            // デフォルトテンプレートを提供
            $sheetType   = $this->resolveSheetType($supplier);
            $templateDir = dirname(APP) . '/resources/excel_templates/';
            $templateMap = [
                'sakana' => 'sakana_template.xlsx',
                'yaoki'  => 'yaoki_template.xlsx',
                'kawano' => 'kawano_template.xlsm',
            ];
            $filePath = $templateDir . ($templateMap[$sheetType] ?? '');
            $fileName = $sheetType . '_template.' . pathinfo($filePath, PATHINFO_EXTENSION);
        }

        if (!file_exists($filePath)) {
            $this->response = $this->response->withStatus(404);
            $this->set(['ok' => false, 'message' => 'テンプレートファイルが見つかりません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $mimeMap = [
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xlsm' => 'application/vnd.ms-excel.sheet.macroenabled.12',
        ];
        $fileExt  = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $mimeType = $mimeMap[$fileExt] ?? 'application/octet-stream';

        $this->response = $this->response
            ->withType($mimeType)
            ->withHeader('Content-Disposition', 'attachment; filename="' . rawurlencode($fileName) . '"')
            ->withHeader('Content-Length', (string)filesize($filePath));

        $this->response->getBody()->write(file_get_contents($filePath));
        $this->viewBuilder()->setClassName('Cake\View\View');
    }

    // ----------------------------------------
    // ヘルパー
    // ----------------------------------------

    private function hasCustomTemplate(int $id, string $ext): bool
    {
        return file_exists(self::UPLOAD_DIR . $id . '.' . $ext);
    }

    private function deleteTemplateFile(int $id, string $ext): bool
    {
        $path = self::UPLOAD_DIR . $id . '.' . $ext;
        if (file_exists($path)) {
            unlink($path);
            return true;
        }
        return false;
    }

    private function resolveSheetType($supplier): string
    {
        $code = strtoupper((string)($supplier->code ?? ''));
        $name = (string)($supplier->name ?? '');
        $sid  = (int)($supplier->id ?? 0);

        if ($code === 'F') return 'sakana';
        if ($code === 'Y') return 'yaoki';
        if ($code === 'M') return 'kawano';
        if (mb_strpos($name, '八百') !== false) return 'yaoki';
        if (mb_strpos($name, '河野') !== false || mb_strpos($name, '牛豚') !== false || mb_strpos($name, '肉') !== false) return 'kawano';
        return match ($sid) { 1 => 'sakana', 2 => 'yaoki', 3 => 'kawano', default => 'sakana' };
    }
}
