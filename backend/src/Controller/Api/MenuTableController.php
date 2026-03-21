<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use PhpOffice\PhpSpreadsheet\IOFactory;
use ZipArchive;
use DOMDocument;
use DateTime;

/**
 * 献立表 API
 *
 * GET /api/menu-table.json?week_start=YYYY-MM-DD
 * GET /api/menu-table/excel?week_start=YYYY-MM-DD&type=staff|children
 *
 * 子供用: ZIP直接操作でシェイプ/画像/書式をそのまま保持
 * 職員用: PhpSpreadsheet でテンプレートに書き込み
 */
class MenuTableController extends AppController
{
    private const XLSX_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    private const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    private const SUPPLIER_MEMO_COLORS = [
        'C' => 'FFFEF3C7', // COOP(生協): 黄色
        'Y' => 'FFD1FAE5', // 八百喜: 緑
        'M' => 'FFFEE2E2', // 河野牛豚肉店: 赤系
        'F' => 'FFE0F2FE', // 魚丹: 水色
        'S' => 'FF1E3A8A', // スーパー: 濃い青
        'Z' => null,       // 在庫: 色なし
    ];

    public function initialize(): void
    {
        parent::initialize();
        $this->Menus = $this->fetchTable('Menus');
        $this->Users = $this->fetchTable('Users');
        $this->Blocks = $this->fetchTable('Blocks');
    }

    // ----------------------------------------
    // GET /api/menu-table.json
    // ----------------------------------------
    public function index(): void
    {
        $weekStart = $this->parseWeekStart($this->request->getQuery('week_start'));
        if (!$weekStart) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'week_start (YYYY-MM-DD の月曜日) は必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }
        $weekEnd  = (clone $weekStart)->modify('+6 days');
        $weekData = $this->getWeekMenuData($weekStart, $weekEnd);
        $this->set([
            'ok'         => true,
            'week_start' => $weekStart->format('Y-m-d'),
            'week_end'   => $weekEnd->format('Y-m-d'),
            'days'       => $weekData,
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'week_start', 'week_end', 'days']);
    }

    // ----------------------------------------
    // GET /api/menu-table/excel?week_start=YYYY-MM-DD&type=staff|children
    // ----------------------------------------
    public function excel(): void
    {
        $weekStart = $this->parseWeekStart($this->request->getQuery('week_start'));
        $type      = $this->request->getQuery('type') === 'children' ? 'children' : 'staff';

        if (!$weekStart) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'week_start は必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $weekEnd   = (clone $weekStart)->modify('+6 days');
        $dataEnd   = $type === 'staff' ? (clone $weekStart)->modify('+11 days') : $weekEnd;
        $dayCount  = $type === 'staff' ? 12 : 7;
        $weekData  = $this->getWeekMenuData($weekStart, $dataEnd, $dayCount);
        $typeLabel = $type === 'children' ? '子供用' : '職員用';
        $filename  = "献立表_{$typeLabel}_{$weekStart->format('Y-m-d')}週.xlsx";
        $tmpFile = $this->buildMenuTableXlsx($weekStart, $type, $weekData, $weekEnd);

        while (ob_get_level() > 0) ob_end_clean();
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename*=UTF-8\'\'' . rawurlencode($filename));
        header('Content-Length: ' . filesize($tmpFile));
        header('Cache-Control: max-age=0, no-store');
        readfile($tmpFile);
        unlink($tmpFile);
        exit;
    }

    // ----------------------------------------
    // GET /api/menu-table/pdf?week_start=YYYY-MM-DD&type=staff|children
    // ----------------------------------------
    public function pdf(): void
    {
        $weekStart = $this->parseWeekStart($this->request->getQuery('week_start'));
        $type      = $this->request->getQuery('type') === 'children' ? 'children' : 'staff';

        if (!$weekStart) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'week_start は必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $weekEnd   = (clone $weekStart)->modify('+6 days');
        $dataEnd   = $type === 'staff' ? (clone $weekStart)->modify('+11 days') : $weekEnd;
        $dayCount  = $type === 'staff' ? 12 : 7;
        $weekData  = $this->getWeekMenuData($weekStart, $dataEnd, $dayCount);
        $typeLabel = $type === 'children' ? '子供用' : '職員用';
        $filename  = "献立表_{$typeLabel}_{$weekStart->format('Y-m-d')}週.pdf";
        $tmpXlsx   = $this->buildMenuTableXlsx($weekStart, $type, $weekData, $weekEnd);

        $outDir = sys_get_temp_dir();
        $pdfFilter = $type === 'children'
            ? 'pdf:calc_pdf_Export:{"SinglePageSheets":{"type":"boolean","value":"true"}}'
            : 'pdf';
        $cmd = sprintf(
            'HOME=/tmp libreoffice --headless --convert-to %s --outdir %s %s 2>&1',
            escapeshellarg($pdfFilter),
            escapeshellarg($outDir),
            escapeshellarg($tmpXlsx)
        );
        exec($cmd, $cmdOutput, $exitCode);
        @unlink($tmpXlsx);

        $pdfFile = $outDir . '/' . basename($tmpXlsx, '.xlsx') . '.pdf';
        if ($exitCode !== 0 || !file_exists($pdfFile)) {
            $this->response = $this->response->withStatus(500);
            $this->set(['ok' => false, 'message' => 'PDF変換に失敗しました: ' . implode(' ', $cmdOutput)]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        while (ob_get_level() > 0) ob_end_clean();
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename*=UTF-8\'\'' . rawurlencode($filename));
        header('Content-Length: ' . filesize($pdfFile));
        header('Cache-Control: max-age=0, no-store');
        readfile($pdfFile);
        @unlink($pdfFile);
        exit;
    }

    private function buildMenuTableXlsx(DateTime $weekStart, string $type, array $weekData, DateTime $weekEnd): string
    {
        if ($type === 'children') {
            // ZIP直接操作: シェイプ・画像・書式を保持
            $blockName = $this->getUserBlockName();
            return $this->generateChildrenExcelZip($weekData, $weekStart, $blockName);
        }

        // PhpSpreadsheet: 職員用（シェイプなし）
        $spreadsheet = $this->generateStaffExcel($weekData, $weekStart, $weekEnd);
        $tmpFile = tempnam(sys_get_temp_dir(), 'menu_staff_') . '.xlsx';
        IOFactory::createWriter($spreadsheet, 'Xlsx')->save($tmpFile);
        return $tmpFile;
    }

    // ========================================
    // 子供用 Excel 生成 — ZIP 直接操作
    //
    // テンプレート構成 (children_template.xlsx):
    //   行8,  C-I: 日付ヘッダー (月〜日)
    //   行10-14, C-I: 朝食 (5行)
    //   行15-18, C-I: 昼食 (4行)
    //   行19-24, C-I: 夕食 (6行)
    // ========================================
    private function generateChildrenExcelZip(array $weekData, DateTime $weekStart, string $blockName = ''): string
    {
        $templateFile = dirname(APP) . '/resources/excel_templates/children_template.xlsx';
        $tmpFile      = tempnam(sys_get_temp_dir(), 'menu_children_') . '.xlsx';
        copy($templateFile, $tmpFile);

        $zip = new ZipArchive();
        if ($zip->open($tmpFile) !== true) {
            throw new \RuntimeException('ZipArchive open failed');
        }

        // --- 共有文字列を読み込む ---
        $sstXml = $zip->getFromName('xl/sharedStrings.xml');
        $sstDom = new DOMDocument('1.0', 'UTF-8');
        $sstDom->loadXML($sstXml);
        $sstRoot = $sstDom->documentElement;
        $ns      = self::XLSX_NS;

        // 既存文字列を配列に
        $strings = [];
        foreach ($sstRoot->getElementsByTagNameNS($ns, 'si') as $si) {
            $buf = '';
            foreach ($si->getElementsByTagNameNS($ns, 't') as $t) {
                $buf .= $t->nodeValue;
            }
            $strings[] = $buf;
        }

        // 文字列を追加して index を返すクロージャ
        $addStr = function (string $s) use (&$strings, $sstRoot, $sstDom, $ns): int {
            $idx = array_search($s, $strings, true);
            if ($idx !== false) return $idx;
            $idx   = count($strings);
            $strings[] = $s;
            $si    = $sstDom->createElementNS($ns, 'si');
            $t     = $sstDom->createElementNS($ns, 't');
            $t->setAttribute('xml:space', 'preserve');
            $t->appendChild($sstDom->createTextNode($s));
            $si->appendChild($t);
            $sstRoot->appendChild($si);
            return $idx;
        };

        // --- シート XML を読み込む ---
        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $sheetDom = new DOMDocument('1.0', 'UTF-8');
        $sheetDom->loadXML($sheetXml);
        $sheetRoot = $sheetDom->documentElement;

        // 行 Map を作る (r属性 → DOMElement)
        $rowMap = [];
        $sheetDataEl = null;
        foreach ($sheetRoot->getElementsByTagNameNS($ns, 'sheetData') as $sd) {
            $sheetDataEl = $sd;
            break;
        }
        if ($sheetDataEl) {
            foreach ($sheetDataEl->getElementsByTagNameNS($ns, 'row') as $rowEl) {
                $rowMap[(int)$rowEl->getAttribute('r')] = $rowEl;
            }
        }

        // セルに文字列 index を書き込む（既存セルの値を更新 or 新規作成）
        $setCell = function (string $ref, string $value) use (
            &$rowMap, $sheetDataEl, $sheetDom, $ns, $addStr
        ): void {
            preg_match('/^([A-Z]+)(\d+)$/', $ref, $m);
            $colLetter = $m[1];
            $rowNum    = (int)$m[2];

            // 行を探す or 作る
            if (!isset($rowMap[$rowNum])) {
                $rowEl = $sheetDom->createElementNS($ns, 'row');
                $rowEl->setAttribute('r', (string)$rowNum);
                // 正しい位置に挿入（行番号順）
                $inserted = false;
                foreach ($rowMap as $rn => $existing) {
                    if ($rn > $rowNum) {
                        $sheetDataEl->insertBefore($rowEl, $existing);
                        $inserted = true;
                        break;
                    }
                }
                if (!$inserted) $sheetDataEl->appendChild($rowEl);
                $rowMap[$rowNum] = $rowEl;
            }
            $rowEl = $rowMap[$rowNum];

            // セルを探す or 作る
            $cellEl = null;
            foreach ($rowEl->getElementsByTagNameNS($ns, 'c') as $c) {
                if ($c->getAttribute('r') === $ref) {
                    $cellEl = $c;
                    break;
                }
            }
            if (!$cellEl) {
                $cellEl = $sheetDom->createElementNS($ns, 'c');
                $cellEl->setAttribute('r', $ref);
                // 列順で挿入
                $inserted = false;
                foreach ($rowEl->getElementsByTagNameNS($ns, 'c') as $c) {
                    if ($this->colLetterToNum($c->getAttribute('r')) > $this->colLetterToNum($ref)) {
                        $rowEl->insertBefore($cellEl, $c);
                        $inserted = true;
                        break;
                    }
                }
                if (!$inserted) $rowEl->appendChild($cellEl);
            }

            // 値を設定（空ならクリア）
            // 子ノードをすべて削除
            while ($cellEl->firstChild) {
                $cellEl->removeChild($cellEl->firstChild);
            }

            if ($value === '') {
                $cellEl->removeAttribute('t');
                return;
            }

            $idx = $addStr($value);
            $cellEl->setAttribute('t', 's');
            $v = $sheetDom->createElementNS($ns, 'v');
            $v->appendChild($sheetDom->createTextNode((string)$idx));
            $cellEl->appendChild($v);
        };

        // --- データを書き込む ---
        // dayIndex(0=月..6=日) → 列
        $dayCol  = [0 => 'C', 1 => 'D', 2 => 'E', 3 => 'F', 4 => 'G', 5 => 'H', 6 => 'I'];
        $mealRows = [
            1 => ['start' => 10, 'count' => 5],  // 朝食
            2 => ['start' => 15, 'count' => 4],  // 昼食
            3 => ['start' => 19, 'count' => 6],  // 夕食
        ];

        // 日付ヘッダーは先に全消去してから上書き
        for ($i = 0; $i < 7; $i++) {
            $setCell($dayCol[$i] . '8', '');
        }

        // 日付ヘッダー (行8)
        for ($i = 0; $i < 7; $i++) {
            $date = $weekData[$i]['date'] ?? '';
            if ($date !== '') {
                $dt = new DateTime($date);
                $setCell($dayCol[$i] . '8', $this->formatJpDate($dt));
            }
        }

        // データクリア & 書き込み
        for ($i = 0; $i < 7; $i++) {
            $meals = $weekData[$i]['meals'] ?? [];
            $col   = $dayCol[$i];

            foreach ($mealRows as $mealType => ['start' => $start, 'count' => $count]) {
                // クリア
                for ($r = $start; $r < $start + $count; $r++) {
                    $setCell($col . $r, '');
                }
                // 書き込み
                if (!isset($meals[$mealType])) continue;
                $row = $start;
                foreach ($meals[$mealType] as $menu) {
                    if ($row >= $start + $count) break;
                    $setCell($col . $row, $menu['menu_name']);
                    $row++;
                }
            }
        }

        // タイトル（WordArt）: 「ブロック名 + 予定献立表」に上書き
        $this->replaceChildrenTitleInDrawing($zip, $blockName !== '' ? $blockName . '予定献立表' : '予定献立表');

        // 子供用は1ページ出力前提のため、シート実体範囲を印刷範囲(A1:I24)に正規化
        // (テンプレート外の余剰行/列があると SinglePageSheets で過縮小される)
        $this->normalizeChildrenSheetForSinglePage($sheetDom, $ns);

        // --- SST の count を更新 ---
        $total = count($strings);
        $sstRoot->setAttribute('count', (string)$total);
        $sstRoot->setAttribute('uniqueCount', (string)$total);

        // --- ZIP に書き戻す ---
        $zip->addFromString('xl/sharedStrings.xml', $sstDom->saveXML());
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetDom->saveXML());
        $zip->close();

        return $tmpFile;
    }

    private function normalizeChildrenSheetForSinglePage(DOMDocument $sheetDom, string $ns): void
    {
        $sheetRoot = $sheetDom->documentElement;
        if (!$sheetRoot) return;

        // 実使用範囲を固定
        foreach ($sheetRoot->getElementsByTagNameNS($ns, 'dimension') as $dimEl) {
            $dimEl->setAttribute('ref', 'A1:I24');
            break;
        }

        // 列定義を A:I のみ残す
        foreach ($sheetRoot->getElementsByTagNameNS($ns, 'cols') as $colsEl) {
            for ($i = $colsEl->childNodes->length - 1; $i >= 0; $i--) {
                $colEl = $colsEl->childNodes->item($i);
                if (!$colEl || $colEl->nodeType !== XML_ELEMENT_NODE || $colEl->localName !== 'col') continue;
                $min = (int)$colEl->getAttribute('min');
                $max = (int)$colEl->getAttribute('max');
                if ($min > 9) {
                    $colsEl->removeChild($colEl);
                    continue;
                }
                if ($max > 9) {
                    $colEl->setAttribute('max', '9');
                }
            }
            break;
        }

        // 行データを 1..24、列 A..I のみ残す
        foreach ($sheetRoot->getElementsByTagNameNS($ns, 'sheetData') as $sheetDataEl) {
            for ($i = $sheetDataEl->childNodes->length - 1; $i >= 0; $i--) {
                $rowEl = $sheetDataEl->childNodes->item($i);
                if (!$rowEl || $rowEl->nodeType !== XML_ELEMENT_NODE || $rowEl->localName !== 'row') continue;
                $rowNum = (int)$rowEl->getAttribute('r');
                if ($rowNum > 24) {
                    $sheetDataEl->removeChild($rowEl);
                    continue;
                }
                for ($j = $rowEl->childNodes->length - 1; $j >= 0; $j--) {
                    $cellEl = $rowEl->childNodes->item($j);
                    if (!$cellEl || $cellEl->nodeType !== XML_ELEMENT_NODE || $cellEl->localName !== 'c') continue;
                    if (!preg_match('/^([A-Z]+)\d+$/', (string)$cellEl->getAttribute('r'), $m)) continue;
                    if ($this->colLetterToNum($m[1]) > 9) {
                        $rowEl->removeChild($cellEl);
                    }
                }
                $rowEl->setAttribute('spans', '1:9');
            }
            break;
        }

        // 余計な改ページ情報を除去
        foreach (['colBreaks', 'rowBreaks'] as $tag) {
            $nodes = $sheetRoot->getElementsByTagNameNS($ns, $tag);
            for ($i = $nodes->length - 1; $i >= 0; $i--) {
                $n = $nodes->item($i);
                if ($n && $n->parentNode) {
                    $n->parentNode->removeChild($n);
                }
            }
        }

        // 印刷倍率を「印刷可能領域に合わせる」に固定
        $pageSetup = null;
        foreach ($sheetRoot->getElementsByTagNameNS($ns, 'pageSetup') as $ps) {
            $pageSetup = $ps;
            break;
        }
        if ($pageSetup) {
            $pageSetup->removeAttribute('scale');
            $pageSetup->setAttribute('fitToWidth', '1');
            $pageSetup->setAttribute('fitToHeight', '1');
        }
    }

    // ========================================
    // 職員用 Excel 生成 (staff_template.xlsx) — PhpSpreadsheet
    //
    // 上半 Row 2: 土(A2), 月(H2), 水(O2), 金(V2)
    // 下半 Row 26: 日(A26), 火(H26), 木(O26)
    // 列グループ: [ラベル, 献立名, 材料, 数量, 発注先, 納品日]
    //   A=[A,B,C,D,E,F], H=[H,I,J,K,L,M], O=[O,P,Q,R,S,T], V=[V,W,X,Y,Z,AA]
    // 朝: 5行, 昼: 6行, 夕: 10行
    // ========================================
    private function generateStaffExcel(array $weekData, DateTime $weekStart, DateTime $weekEnd): \PhpOffice\PhpSpreadsheet\Spreadsheet
    {
        $templateFile = dirname(APP) . '/resources/excel_templates/staff_template.xlsx';
        $spreadsheet  = IOFactory::load($templateFile);

        // テンプレートは週ごとにシートが分かれている（11月1日～3月13日）
        // weekStart+5 = 土曜日を先頭日とするシート名を検索して使用する
        $satDate   = (clone $weekStart)->modify('+5 days');
        $satLabel  = (int)$satDate->format('n') . '月' . (int)$satDate->format('j') . '日';
        $sheetIdx  = 0;
        for ($i = 0; $i < $spreadsheet->getSheetCount(); $i++) {
            if (strpos($spreadsheet->getSheet($i)->getTitle(), $satLabel) === 0) {
                $sheetIdx = $i;
                break;
            }
        }
        // PDF/印刷時にテンプレート全シートが出ないよう、対象週シートのみ残す
        for ($i = $spreadsheet->getSheetCount() - 1; $i >= 0; $i--) {
            if ($i !== $sheetIdx) {
                $spreadsheet->removeSheetByIndex($i);
            }
        }
        $spreadsheet->setActiveSheetIndex(0);
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->getPageSetup()
            ->setFitToPage(true)
            ->setFitToWidth(1)
            ->setFitToHeight(1);

        // タイトル行（A1）を選択週に連動
        // 形式: 「◯月◯日(土)～ ◯月◯日(金)献立表」
        $titleStart = (clone $weekStart)->modify('+5 days'); // 土
        $titleEnd   = (clone $titleStart)->modify('+6 days'); // 翌週金
        $sheet->getCell('A1')->setValueExplicit(
            '　　' . $this->formatJpDate($titleStart) . '～　' . $this->formatJpDate($titleEnd) . '献立表',
            \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING
        );

        $colGroups = [
            'A' => ['A', 'B', 'C', 'D', 'E', 'F'],
            'H' => ['H', 'I', 'J', 'K', 'L', 'M'],
            'O' => ['O', 'P', 'Q', 'R', 'S', 'T'],
            'V' => ['V', 'W', 'X', 'Y', 'Z', 'AA'],
        ];

        // 上半: 土=weekStart+5, 月=weekStart+7, 水=weekStart+9, 金=weekStart+11
        $topSection = [
            ['dayOffset' => 5, 'cgKey' => 'A', 'dateCell' => 'A2'],
            ['dayOffset' => 7, 'cgKey' => 'H', 'dateCell' => 'H2'],
            ['dayOffset' => 9, 'cgKey' => 'O', 'dateCell' => 'O2'],
            ['dayOffset' => 11, 'cgKey' => 'V', 'dateCell' => 'V2'],
        ];
        $topMealRows = [
            1 => ['start' => 4,  'count' => 5],
            2 => ['start' => 9,  'count' => 6],
            3 => ['start' => 15, 'count' => 10],
        ];

        // 下半: 日=weekStart+6, 火=weekStart+8, 木=weekStart+10
        $bottomSection = [
            ['dayOffset' => 6, 'cgKey' => 'A', 'dateCell' => 'A26'],
            ['dayOffset' => 8, 'cgKey' => 'H', 'dateCell' => 'H26'],
            ['dayOffset' => 10, 'cgKey' => 'O', 'dateCell' => 'O26'],
        ];
        $bottomMealRows = [
            1 => ['start' => 28, 'count' => 5],
            2 => ['start' => 33, 'count' => 6],
            3 => ['start' => 39, 'count' => 10],
        ];

        foreach ($topSection as $entry) {
            $dayIndex = $entry['dayOffset'];
            $date     = $weekData[$dayIndex]['date']  ?? '';
            $meals    = $weekData[$dayIndex]['meals'] ?? [];
            $cg       = $colGroups[$entry['cgKey']];
            if ($date !== '') {
                $sheet->getCell($entry['dateCell'])->setValueExplicit(
                    $this->formatJpDate(new DateTime($date)),
                    \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING
                );
            }
            $this->clearStaffSection($sheet, $cg, $topMealRows);
            $this->fillStaffSection($sheet, $cg, $topMealRows, $meals, $weekStart);
        }

        // V-AA 列（下半メモエリア）と stray セルをまとめてクリア
        $this->clearStaffExtraAreas($sheet);

        foreach ($bottomSection as $entry) {
            $dayIndex = $entry['dayOffset'];
            $date     = $weekData[$dayIndex]['date']  ?? '';
            $meals    = $weekData[$dayIndex]['meals'] ?? [];
            $cg       = $colGroups[$entry['cgKey']];
            if ($date !== '') {
                $sheet->getCell($entry['dateCell'])->setValueExplicit(
                    $this->formatJpDate(new DateTime($date)),
                    \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING
                );
            }
            $this->clearStaffSection($sheet, $cg, $bottomMealRows);
            $this->fillStaffSection($sheet, $cg, $bottomMealRows, $meals, $weekStart);
        }

        // メモエリアに発注先・発注日・納品日を書き込む
        $this->writeMemoSection($sheet, $weekStart);

        return $spreadsheet;
    }

    private function clearStaffSection($sheet, array $cg, array $mealRows): void
    {
        [, $menuCol, $ingCol, $qtyCol, $supCol, $delCol] = $cg;
        foreach ($mealRows as ['start' => $start, 'count' => $count]) {
            for ($r = $start; $r < $start + $count; $r++) {
                foreach ([$menuCol, $ingCol, $qtyCol, $supCol, $delCol] as $col) {
                    $sheet->getCell($col . $r)->setValue('');
                }
            }
        }
    }

    /**
     * 下半部 V-AA メモエリア (行40-48) と日付行のスト セルをクリア
     * clearStaffSection が担当しない領域を補完する
     */
    private function clearStaffExtraAreas($sheet): void
    {
        // V40:AA48 内の既存セル結合を解除（再マージに備えて）
        foreach ($sheet->getMergeCells() as $merge) {
            if (preg_match('/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/', $merge, $m)) {
                if ((int)$m[2] >= 40 && (int)$m[4] <= 48) {
                    $sheet->unmergeCells($merge);
                }
            }
        }

        // 下半 V-AA 列 (行40-48) をすべてクリア（テンプレートの固定データ除去）
        $vCols = ['V', 'W', 'X', 'Y', 'Z', 'AA'];
        for ($r = 40; $r <= 48; $r++) {
            foreach ($vCols as $col) {
                $sheet->getCell($col . $r)->setValue('');
            }
        }

        // 上半日付行 (行2) のデータ列をクリア（祝日名など stray データ対策）
        $topDataCols = ['B','C','D','E','F','G','I','J','K','L','M','N','P','Q','R','S','T','U','W','X','Y','Z','AA'];
        foreach ($topDataCols as $col) {
            $sheet->getCell($col . '2')->setValue('');
        }

        // 下半日付行 (行26) のデータ列をクリア
        $bottomDataCols = ['B','C','D','E','F','G','I','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z','AA'];
        foreach ($bottomDataCols as $col) {
            $sheet->getCell($col . '26')->setValue('');
        }
    }

    /**
     * 下半 V-AA 列 (行40-48) にメモ（発注先・発注日・納品日）を書き込む
     * 発注日 = 各納品日の前日（納品日ごとに1行）
     * 業者名は複数納品日がある場合にセル結合して縦中央表示
     */
    private function writeMemoSection($sheet, DateTime $weekStart): void
    {
        $st       = \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING;
        $dayNames = ['日', '月', '火', '水', '木', '金', '土'];

        // メモ欄 V:AA の幅は内容に合わせて自動調整
        foreach (['V', 'W', 'X', 'Y', 'Z', 'AA'] as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $fmtDate = function (DateTime $d) use ($dayNames): string {
            return (int)$d->format('n') . '月'
                . (int)$d->format('j') . '日('
                . $dayNames[(int)$d->format('w')] . ')';
        };

        // has_order_sheet = 1 の業者を取得
        $conn      = $this->Menus->getConnection();
        $suppliers = $conn->execute(
            "SELECT id, code, name, delivery_days, order_day FROM suppliers WHERE has_order_sheet = 1 ORDER BY id"
        )->fetchAll('assoc');

        // ヘッダー行 (行40)
        $row = 40;
        $sheet->mergeCells("V{$row}:W{$row}");
        $sheet->getCell('V' . $row)->setValueExplicit('発注先', $st);
        $sheet->getCell('X' . $row)->setValueExplicit('発注日', $st);
        $sheet->getCell('Y' . $row)->setValueExplicit('納品日', $st);
        $sheet->getCell('Z' . $row)->setValueExplicit('', $st);
        $sheet->getCell('AA' . $row)->setValueExplicit('', $st);
        $sheet->getStyle("V{$row}:AA{$row}")->getFont()->setBold(true);
        $sheet->getStyle("V{$row}:AA{$row}")->getAlignment()
            ->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER)
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("V{$row}:AA{$row}")->getFont()->setSize(11);
        $sheet->getRowDimension($row)->setRowHeight(18);
        $row++;

        foreach ($suppliers as $sup) {
            if ($row > 48) break;
            $orderDates = [];
            $deliveryDates = [];
            $orderDay = ($sup['order_day'] !== null && $sup['order_day'] !== '') ? (int)$sup['order_day'] : null;
            foreach ($this->parseMemoDeliveryDates((string)$sup['delivery_days'], $weekStart) as $deliveryDate) {
                $orderDate    = $this->calcMemoOrderDate($deliveryDate, $orderDay);
                $orderDates[] = $fmtDate($orderDate);
                $deliveryDates[] = $fmtDate($deliveryDate);
            }
            if (empty($deliveryDates)) continue;

            // 納品日は Y/Z/AA に3件ずつ配置し、超過分は次行へ回す
            $deliveryRows = array_chunk($deliveryDates, 3);
            $rowsNeeded = count($deliveryRows);
            $maxRows = 48 - $row + 1;
            if ($rowsNeeded > $maxRows) {
                $deliveryRows = array_slice($deliveryRows, 0, $maxRows);
                $rowsNeeded = count($deliveryRows);
            }
            if ($rowsNeeded <= 0) break;
            $endRow = $row + $rowsNeeded - 1;

            // 発注先・発注日は納品日が複数列/複数行にまたがる場合に縦結合
            $sheet->mergeCells("V{$row}:W{$endRow}");
            if ($endRow > $row) {
                $sheet->mergeCells("X{$row}:X{$endRow}");
            }

            $sheet->getCell('V' . $row)->setValueExplicit($sup['name'], $st);
            $uniqueOrderDates = array_values(array_unique($orderDates));
            $sheet->getCell('X' . $row)->setValueExplicit(implode("\n", $uniqueOrderDates), $st);

            // 対象行の納品日セルを初期化
            for ($r = $row; $r <= $endRow; $r++) {
                $sheet->getCell('Y' . $r)->setValueExplicit('', $st);
                $sheet->getCell('Z' . $r)->setValueExplicit('', $st);
                $sheet->getCell('AA' . $r)->setValueExplicit('', $st);
            }

            foreach ($deliveryRows as $i => $chunk) {
                $targetRow = $row + $i;
                $sheet->getCell('Y' . $targetRow)->setValueExplicit($chunk[0] ?? '', $st);
                $sheet->getCell('Z' . $targetRow)->setValueExplicit($chunk[1] ?? '', $st);
                $sheet->getCell('AA' . $targetRow)->setValueExplicit($chunk[2] ?? '', $st);
            }

            $sheet->getStyle("V{$row}:AA{$endRow}")->getFont()->setBold(false);
            $sheet->getStyle("V{$row}:AA{$endRow}")->getFont()->setSize(11);
            $sheet->getStyle("V{$row}:AA{$endRow}")->getAlignment()
                ->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_TOP)
                ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_LEFT)
                ->setWrapText(true);

            $lineCount = max(count($uniqueOrderDates), 1);
            for ($r = $row; $r <= $endRow; $r++) {
                $sheet->getRowDimension($r)->setRowHeight(20 * $lineCount);
            }

            $fillColor = $this->memoSupplierColor((string)($sup['code'] ?? ''), (string)$sup['name']);
            $fill = $sheet->getStyle("V{$row}:W{$endRow}")->getFill();
            if ($fillColor === null) {
                $fill->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_NONE);
            } else {
                $fill->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                    ->getStartColor()
                    ->setARGB($fillColor);
            }
            $row = $endRow + 1;
        }
    }

    /**
     * メモ欄用: delivery_days を日付配列に展開（パイプ2週形式にも対応）
     * 返却は昇順 DateTime[]（重複除去済み）
     */
    private function parseMemoDeliveryDates(string $deliveryDays, DateTime $weekStart): array
    {
        $seen = [];
        $dates = [];

        if (strpos($deliveryDays, '|') !== false) {
            [$w1, $w2] = array_pad(explode('|', $deliveryDays, 2), 2, '');
            $bases = [
                [trim($w1), clone $weekStart],
                [trim($w2), (clone $weekStart)->modify('+7 days')],
            ];
        } else {
            $bases = [[trim($deliveryDays), clone $weekStart]];
        }

        foreach ($bases as [$part, $baseWeek]) {
            if ($part === '') continue;
            foreach (explode(',', $part) as $entry) {
                $entry = trim($entry);
                if ($entry === '') continue;

                if (strpos($entry, ':') !== false) {
                    [$weekNum, $dayOffset] = array_map('intval', explode(':', $entry, 2));
                } else {
                    $weekNum = 0;
                    $dayOffset = (int)$entry;
                }

                $d = clone $baseWeek;
                $d->modify("+{$dayOffset} days");
                if ($weekNum > 0) {
                    $actualWeekNum = (int)ceil(((int)$d->format('j')) / 7);
                    if ($actualWeekNum !== $weekNum) {
                        continue;
                    }
                }
                $key = $d->format('Y-m-d');
                if (!isset($seen[$key])) {
                    $seen[$key] = true;
                    $dates[] = $d;
                }
            }
        }

        usort($dates, fn(DateTime $a, DateTime $b) => $a <=> $b);
        return $dates;
    }

    /**
     * メモ欄用: 発注日計算
     * order_day がある場合は「納品日が属する週」の指定曜日を発注日とする
     * 未設定時は従来どおり納品日の前日
     */
    private function calcMemoOrderDate(DateTime $deliveryDate, ?int $orderDay): DateTime
    {
        if ($orderDay === null) {
            return (clone $deliveryDate)->modify('-1 day');
        }

        $monday = clone $deliveryDate;
        $dow = (int)$monday->format('N') - 1; // 0=月..6=日
        if ($dow > 0) {
            $monday->modify("-{$dow} days");
        }
        return (clone $monday)->modify("+{$orderDay} days");
    }

    private function memoSupplierColor(string $code, string $name): ?string
    {
        $u = strtoupper(trim($code));
        if ($u !== '' && array_key_exists($u, self::SUPPLIER_MEMO_COLORS)) {
            return self::SUPPLIER_MEMO_COLORS[$u];
        }
        if (mb_strpos($name, 'COOP') !== false || mb_strpos($name, '生協') !== false) return self::SUPPLIER_MEMO_COLORS['C'];
        if (mb_strpos($name, '八百喜') !== false) return self::SUPPLIER_MEMO_COLORS['Y'];
        if (mb_strpos($name, '河野') !== false || mb_strpos($name, '牛豚') !== false) return self::SUPPLIER_MEMO_COLORS['M'];
        if (mb_strpos($name, '魚丹') !== false) return self::SUPPLIER_MEMO_COLORS['F'];
        if (mb_strpos($name, '在庫') !== false) return self::SUPPLIER_MEMO_COLORS['Z'];
        if (mb_strpos($name, 'スーパー') !== false) return self::SUPPLIER_MEMO_COLORS['S'];
        return null;
    }

    private function fillStaffSection($sheet, array $cg, array $mealRows, array $meals, DateTime $weekStart): void
    {
        [, $menuCol, $ingCol, $qtyCol, $supCol, $delCol] = $cg;
        foreach ([1, 2, 3] as $mealType) {
            if (!isset($mealRows[$mealType]) || !isset($meals[$mealType])) continue;
            $startRow = $mealRows[$mealType]['start'];
            $maxRows  = $mealRows[$mealType]['count'];
            $row      = $startRow;
            $endRow   = $startRow + $maxRows;

            foreach ($meals[$mealType] as $menu) {
                if ($row >= $endRow) break;
                $menuName    = $menu['menu_name'];
                $ingredients = $menu['ingredients'];
                if (empty($ingredients)) {
                    $sheet->getCell($menuCol . $row)->setValueExplicit($menuName, \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
                    $sheet->getStyle($menuCol . $row)->getFont()->setBold(false);
                    $row++;
                } else {
                    foreach ($ingredients as $i => $ing) {
                        if ($row >= $endRow) break;
                        if ($i === 0) {
                            $sheet->getCell($menuCol . $row)->setValueExplicit($menuName, \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
                            $sheet->getStyle($menuCol . $row)->getFont()->setBold(false);
                        }
                        $sheet->getCell($ingCol . $row)->setValueExplicit($ing['name'], \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
                        $sheet->getCell($qtyCol . $row)->setValueExplicit($this->fmtQty($ing['amount'], $ing['unit']), \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
                        $sheet->getCell($supCol . $row)->setValueExplicit($ing['supplier_code'], \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
                        $sheet->getCell($delCol . $row)->setValueExplicit($ing['delivery_date'], \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
                        $sheet->getStyle($ingCol . $row)->getFont()->setBold(false);
                        $sheet->getStyle($qtyCol . $row)->getFont()->setBold(false);
                        $sheet->getStyle($supCol . $row)->getFont()->setBold(false);
                        $sheet->getStyle($delCol . $row)->getFont()->setBold(false);
                        $row++;
                    }
                }
            }
        }
    }

    // ----------------------------------------
    // DB: 週間献立データ取得
    // Z-supplier は grams_per_person × order_quantity で計算
    // ----------------------------------------
    private function getWeekMenuData(DateTime $weekStart, DateTime $weekEnd, int $dayCount = 7): array
    {
        $conn = $this->Menus->getConnection();

        $rows = $conn->execute("
            SELECT
                m.menu_date,
                m.meal_type,
                m.name      AS menu_name,
                m.block_id,
                mi.name     AS ingredient_name,
                mi.unit,
                mi.sort_order,
                COALESCE(s.id,   0)  AS supplier_id,
                COALESCE(s.code, '') AS supplier_code,
                COALESCE(s.delivery_days, '') AS delivery_days,
                CASE
                    WHEN s.code = 'Z'
                    THEN SUM(mm.grams_per_person * COALESCE(boq.order_quantity, 0))
                    ELSE SUM(mi.amount * COALESCE(boq.order_quantity, 0))
                END AS total_amount
            FROM menus m
            JOIN menu_masters mm
              ON mm.name = m.name
             AND (mm.block_id = m.block_id OR mm.block_id IS NULL)
            JOIN menu_ingredients mi
              ON mi.menu_master_id = mm.id
             AND mi.name != ''
            LEFT JOIN suppliers s ON s.id = mi.supplier_id
            LEFT JOIN block_order_quantities boq
              ON boq.order_date = m.menu_date
             AND boq.block_id   = m.block_id
             AND boq.meal_type  = m.meal_type
            WHERE m.menu_date BETWEEN :start AND :end
            GROUP BY m.menu_date, m.meal_type, m.name, m.block_id,
                     mi.name, mi.unit, mi.sort_order, s.id, s.code, s.delivery_days
            ORDER BY m.menu_date, m.meal_type, m.name, mi.sort_order
        ", ['start' => $weekStart->format('Y-m-d'), 'end' => $weekEnd->format('Y-m-d')])->fetchAll('assoc');

        $menuRows = $conn->execute("
            SELECT DISTINCT menu_date, meal_type, name AS menu_name
            FROM menus
            WHERE menu_date BETWEEN :start AND :end
            ORDER BY menu_date, meal_type, name
        ", ['start' => $weekStart->format('Y-m-d'), 'end' => $weekEnd->format('Y-m-d')])->fetchAll('assoc');

        // メニュー存在マップ: [date][meal_type][menu_name] = true
        $menuTree = [];
        foreach ($menuRows as $r) {
            $menuTree[$r['menu_date']][(int)$r['meal_type']][$r['menu_name']] = true;
        }

        // 複数ブロックで同じメニュー・食材を出す場合の合算
        // キー: (ingredient_name, unit, supplier_id) ごとに amount を加算
        $ingMap = []; // [date][meal_type][menu_name][ingKey] = ingredient_data
        foreach ($rows as $r) {
            $d    = $r['menu_date'];
            $t    = (int)$r['meal_type'];
            $n    = $r['menu_name'];
            $unit = $r['supplier_code'] === 'Z' ? 'g' : $r['unit'];
            $key  = $r['ingredient_name'] . '||' . $unit . '||' . (int)$r['supplier_id'];

            if (!isset($ingMap[$d][$t][$n][$key])) {
                $ingMap[$d][$t][$n][$key] = [
                    'name'          => $r['ingredient_name'],
                    'amount'        => 0.0,
                    'unit'          => $unit,
                    'supplier_code' => $r['supplier_code'],
                    'supplier_id'   => (int)$r['supplier_id'],
                    'delivery_days' => $r['delivery_days'],
                    'sort_order'    => (int)$r['sort_order'],
                ];
            } else {
                // 複数ブロック分: sort_order は最小値を使用
                $ingMap[$d][$t][$n][$key]['sort_order'] = min(
                    $ingMap[$d][$t][$n][$key]['sort_order'],
                    (int)$r['sort_order']
                );
            }
            $ingMap[$d][$t][$n][$key]['amount'] += (float)$r['total_amount'];
        }

        $result = [];
        for ($i = 0; $i < $dayCount; $i++) {
            $date  = (clone $weekStart)->modify("+{$i} days")->format('Y-m-d');
            $meals = [];
            foreach ([1, 2, 3, 4] as $mealType) {
                if (!isset($menuTree[$date][$mealType])) continue;
                $menuNames = array_keys($menuTree[$date][$mealType]);

                // 外食メニューがある場合は通常メニューより優先
                $hasEatingOut = false;
                foreach ($menuNames as $n) {
                    if (str_starts_with($n, '外食')) { $hasEatingOut = true; break; }
                }
                if ($hasEatingOut) {
                    $menuNames = array_filter($menuNames, fn($n) => str_starts_with($n, '外食'));
                }

                $menus = [];
                foreach ($menuNames as $menuName) {
                    $ingredients = array_values($ingMap[$date][$mealType][$menuName] ?? []);
                    usort($ingredients, fn($a, $b) => $a['sort_order'] - $b['sort_order']);
                    $enriched = [];
                    foreach ($ingredients as $ing) {
                        $ing['delivery_date'] = $this->calcDeliveryDate(
                            $ing['delivery_days'], $date, $weekStart
                        );
                        unset($ing['delivery_days'], $ing['supplier_id'], $ing['sort_order']);
                        $enriched[] = $ing;
                    }
                    $menus[] = ['menu_name' => $menuName, 'ingredients' => $enriched];
                }
                $meals[$mealType] = $menus;
            }
            $result[$i] = ['date' => $date, 'meals' => $meals];
        }
        return $result;
    }

    // ----------------------------------------
    // 納品日計算
    // ----------------------------------------
    private function calcDeliveryDate(string $deliveryDays, string $menuDate, DateTime $weekStart): string
    {
        if ($deliveryDays === '') return '';
        $menuDt  = new DateTime($menuDate);
        $offsets = array_map('intval', explode(',', $deliveryDays));

        // オフセット % 7 で実際の曜日（0=月,...,6=日）を取得
        $deliveryDows = array_unique(array_map(fn($o) => $o % 7, $offsets));

        // メニュー日の曜日（0=月,...,6=日）
        $menuDow = (int)$menuDt->format('N') - 1; // format('N'): 1=Mon,...,7=Sun

        $best = null;
        foreach ($deliveryDows as $dow) {
            // メニュー日から何日前にその曜日があるか
            $daysBack  = ($menuDow - $dow + 7) % 7;
            $candidate = (clone $menuDt)->modify("-{$daysBack} days");
            if ($best === null || $candidate > $best) {
                $best = $candidate;
            }
        }

        if ($best === null) return '';
        $dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        $dow      = $dayNames[(int)$best->format('w')];
        return (int)$best->format('n') . '月' . (int)$best->format('j') . '日(' . $dow . ')';
    }

    // ----------------------------------------
    // ユーティリティ
    // ----------------------------------------

    /** 列名（例: "AA"）を数値に変換（列順ソート用） */
    private function colLetterToNum(string $ref): int
    {
        preg_match('/^([A-Z]+)/', $ref, $m);
        $col = $m[1] ?? '';
        $n   = 0;
        for ($i = 0; $i < strlen($col); $i++) {
            $n = $n * 26 + (ord($col[$i]) - ord('A') + 1);
        }
        return $n;
    }

    private function formatJpDate(DateTime $dt): string
    {
        $dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        $dow      = $dayNames[(int)$dt->format('w')];
        return (int)$dt->format('n') . '月' . (int)$dt->format('j') . '日(' . $dow . ')';
    }

    private function fmtQty(float $amount, string $unit): string
    {
        if ($amount <= 0) return '';
        if ($unit === 'g' && $amount >= 1000) {
            $kg  = $amount / 1000;
            $val = ($kg == (int)$kg) ? (int)$kg : round($kg, 2);
            return $val . 'kg';
        }
        $val = ($amount == (int)$amount) ? (int)$amount : $amount;
        return $val . $unit;
    }

    private function parseWeekStart(?string $str): ?DateTime
    {
        if (!$str || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $str)) return null;
        $d   = new DateTime($str);
        $dow = (int)$d->format('N');
        if ($dow !== 1) $d->modify('-' . ($dow - 1) . ' days');
        return $d;
    }

    private function replaceChildrenTitleInDrawing(ZipArchive $zip, string $title): void
    {
        $drawingXml = $zip->getFromName('xl/drawings/drawing1.xml');
        if ($drawingXml === false) {
            return;
        }

        $drawingDom = new DOMDocument('1.0', 'UTF-8');
        $drawingDom->loadXML($drawingXml);

        $updated = false;
        foreach ($drawingDom->getElementsByTagNameNS(self::DRAWING_NS, 't') as $textEl) {
            if ($textEl->nodeValue === '予定献立表' || str_contains((string)$textEl->nodeValue, '予定献立表')) {
                $textEl->nodeValue = $title;
                $updated = true;
                break;
            }
        }

        if ($updated) {
            $zip->addFromString('xl/drawings/drawing1.xml', $drawingDom->saveXML());
        }
    }

    private function getUserBlockName(): string
    {
        try {
            $header = $this->request->getHeaderLine('Authorization');
            if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
                return '';
            }

            $token = $m[1];
            $user = $this->Users->find()->where(['api_token' => $token])->first();
            if (!$user || !$user->block_id) {
                return '';
            }

            $block = $this->Blocks->find()->where(['id' => $user->block_id])->first();
            return $block ? str_replace('ブロック', '', (string)$block->name) : '';
        } catch (\Throwable $e) {
            error_log('getUserBlockName failed: ' . $e->getMessage());
            return '';
        }
    }
}
