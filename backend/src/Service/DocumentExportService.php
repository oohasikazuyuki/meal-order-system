<?php
namespace App\Service;

/**
 * 帳票（XLSX / PDF）を書き出して返すまでの共通処理。
 *
 * 献立表と発注書で、LibreOffice の起動・変換の成否判定・ファイル送出が
 * それぞれ別々に書かれていた。同じ処理が4か所にあると、
 * 片方だけ直して片方が古いまま、という壊れ方をする。
 *
 * PDF変換は LibreOffice のヘッドレス起動に依存する。
 * コンテナに libreoffice が入っていることが前提。
 */
class DocumentExportService
{
    public const MIME_PDF  = 'application/pdf';
    public const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    /**
     * XLSX を PDF に変換して、できた PDF のパスを返す。
     * 元の XLSX は成否にかかわらず削除する。
     *
     * @param string $xlsxPath 変換元。呼び出し側は解放を気にしなくてよい
     * @param string $filter   LibreOffice の変換フィルタ。
     *                         子供用献立表のように1ページに収めたい場合は
     *                         'pdf:calc_pdf_Export:{...}' を渡す
     * @throws DocumentExportException 変換に失敗したとき
     */
    public function convertToPdf(string $xlsxPath, string $filter = 'pdf'): string
    {
        $outDir = sys_get_temp_dir();
        $cmd = sprintf(
            'HOME=/tmp libreoffice --headless --convert-to %s --outdir %s %s 2>&1',
            escapeshellarg($filter),
            escapeshellarg($outDir),
            escapeshellarg($xlsxPath)
        );

        exec($cmd, $output, $exitCode);
        @unlink($xlsxPath);

        $pdfPath = $outDir . '/' . basename($xlsxPath, '.xlsx') . '.pdf';
        if ($exitCode !== 0 || !file_exists($pdfPath)) {
            throw new DocumentExportException(
                'PDF変換に失敗しました: ' . implode(' ', $output)
            );
        }

        return $pdfPath;
    }

    /**
     * ファイルを本文として送り出して、そこで処理を終える。
     *
     * CakePHP のレスポンスを経由せず直接出力している。
     * 途中で挟まったバッファを落としてから送らないと、
     * 先頭にゴミが付いた壊れたファイルが落ちてくるため。
     *
     * @param bool $inline true ならブラウザ内で表示、false なら保存ダイアログ
     */
    public function send(string $path, string $filename, string $mime, bool $inline = false): void
    {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        header('Content-Type: ' . $mime);
        header(sprintf(
            "Content-Disposition: %s; filename*=UTF-8''%s",
            $inline ? 'inline' : 'attachment',
            rawurlencode($filename)
        ));
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: max-age=0, no-store');

        readfile($path);
        @unlink($path);
        exit;
    }

    /** XLSX を作って PDF にして送るところまで一息で行う */
    public function sendAsPdf(string $xlsxPath, string $filename, string $filter = 'pdf'): void
    {
        $this->send($this->convertToPdf($xlsxPath, $filter), $filename, self::MIME_PDF, true);
    }

    /** XLSX をそのまま保存させる */
    public function sendAsXlsx(string $xlsxPath, string $filename): void
    {
        $this->send($xlsxPath, $filename, self::MIME_XLSX, false);
    }
}
