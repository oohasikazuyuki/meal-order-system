# クリーンアーキテクチャー設計書

## 概要

このプロジェクトは、Robert C. Martin（Uncle Bob）が提唱するクリーンアーキテクチャーを採用しています。

## アーキテクチャー図

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│              (src/Controller/Api/)                          │
│         HTTPリクエスト/レスポンス、ルーティング                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
│         (src/Application/UseCase/, DTO/)                    │
│      ユースケース実装、入出力データ変換、トランザクション           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer                            │
│   (src/Domain/Entity/, ValueObject/, Service/, Repository/)  │
│       ビジネスロジック、ドメインルール、エンティティ              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                        │
│        (src/Infrastructure/Persistence/, External/)          │
│       データベース、外部API、フレームワーク依存実装               │
└─────────────────────────────────────────────────────────────┘
```

## 依存関係の原則

**依存性逆転の原則（Dependency Inversion Principle）**

- 外側の層は内側の層に依存できる
- 内側の層は外側の層に依存してはならない
- ドメイン層はインフラストラクチャ層に依存しない
- インフラストラクチャ層がドメイン層のインターフェースを実装する

```
Controller → UseCase → Domain ← Infrastructure
                         ↑            ↓
                    (interface)  (implementation)
```

## 各層の詳細

### 1. Domain Layer（ドメイン層）- ビジネスロジックの中心

#### Entity（エンティティ）
```
src/Domain/Entity/
├── Order.php          - 発注エンティティ
├── User.php           - ユーザーエンティティ
└── Menu.php           - メニューエンティティ
```

**責務:**
- ビジネスロジックのカプセル化
- 不変条件（invariant）の保護
- ドメインルールの実装

**例:**
```php
class Order
{
    public function updateQuantity(int $quantity): void
    {
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('数量は1以上である必要があります');
        }
        $this->quantity = $quantity;
    }
}
```

#### Value Object（値オブジェクト）
```
src/Domain/ValueObject/
├── OrderId.php        - 発注ID
├── OrderDate.php      - 発注日
└── OrderStatus.php    - 発注ステータス
```

**責務:**
- 不変性の保証
- 値の妥当性検証
- ビジネスルールの表現

**特徴:**
- イミュータブル（不変）
- 等価性は値で判断
- 副作用なし

**例:**
```php
final class OrderDate
{
    private string $value;
    
    private function __construct(string $value)
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            throw new \InvalidArgumentException('無効な日付形式');
        }
        $this->value = $value;
    }
    
    public static function fromString(string $value): self
    {
        return new self($value);
    }
}
```

#### Repository Interface（リポジトリインターフェース）
```
src/Domain/Repository/
├── OrderRepositoryInterface.php
├── UserRepositoryInterface.php
└── MenuRepositoryInterface.php
```

**責務:**
- データアクセスの抽象化
- ドメイン層とインフラ層の疎結合化
- 永続化の詳細を隠蔽

#### Domain Service（ドメインサービス）
```
src/Domain/Service/
├── OrderDomainService.php
└── MenuDomainService.php
```

**責務:**
- 複数エンティティにまたがるビジネスロジック
- エンティティに属さないドメインロジック

**例:**
```php
class OrderDomainService
{
    public function isDuplicateOrder(int $userId, int $menuId, OrderDate $date): bool
    {
        // 重複チェックロジック
    }
}
```

### 2. Application Layer（アプリケーション層）

#### UseCase（ユースケース）
```
src/Application/UseCase/
├── CreateOrderUseCase.php
├── UpdateOrderUseCase.php
├── DeleteOrderUseCase.php
├── GetOrderListUseCase.php
└── GetOrderSummaryByDateUseCase.php
```

**責務:**
- ユースケースの実装
- トランザクション管理
- ドメインオブジェクトの協調
- ビジネスフローの制御

**特徴:**
- 1つのユースケース = 1つのクラス
- 単一責任の原則（SRP）に従う
- ドメインロジックは含まない

**例:**
```php
class CreateOrderUseCase
{
    public function execute(CreateOrderDTO $dto): Order
    {
        // 1. バリデーション
        // 2. ドメインサービスによるビジネスルールチェック
        // 3. エンティティ生成
        // 4. 永続化
        return $order;
    }
}
```

#### DTO（Data Transfer Object）
```
src/Application/DTO/
├── CreateOrderDTO.php
├── UpdateOrderDTO.php
└── OrderResponseDTO.php
```

**責務:**
- 層間のデータ転送
- 入力データの検証
- データ構造の定義

**特徴:**
- ビジネスロジックを持たない
- public プロパティのみ
- バリデーションメソッドを含む

### 3. Infrastructure Layer（インフラストラクチャ層）

#### Persistence（永続化）
```
src/Infrastructure/Persistence/
├── CakeOrderRepository.php
├── CakeUserRepository.php
└── CakeMenuRepository.php
```

**責務:**
- リポジトリインターフェースの実装
- ORMとの連携
- ドメインエンティティとDBエンティティの変換

**例:**
```php
class CakeOrderRepository implements OrderRepositoryInterface
{
    public function save(Order $order): void
    {
        // ドメインエンティティをCakeエンティティに変換
        // DBに保存
    }
    
    private function toDomain($cakeEntity): Order
    {
        // Cakeエンティティをドメインエンティティに変換
    }
}
```

#### External（外部連携）
```
src/Infrastructure/External/
├── KamahoApiClient.php
└── ExternalMenuProvider.php
```

**責務:**
- 外部APIとの通信
- 外部システムとの連携

### 4. Presentation Layer（プレゼンテーション層）

#### Controller
```
src/Controller/Api/
└── CleanOrdersController.php
```

**責務:**
- HTTPリクエストの受け取り
- UseCaseの呼び出し
- レスポンスの整形
- HTTPステータスコードの設定

**特徴:**
- ビジネスロジックを含まない
- 薄い層として実装
- エラーハンドリング

## ディレクトリ構造

```
backend/src/
├── Controller/
│   └── Api/                    # プレゼンテーション層
│       └── CleanOrdersController.php
│
├── Application/                # アプリケーション層
│   ├── UseCase/
│   │   ├── CreateOrderUseCase.php
│   │   ├── UpdateOrderUseCase.php
│   │   ├── DeleteOrderUseCase.php
│   │   ├── GetOrderListUseCase.php
│   │   └── GetOrderSummaryByDateUseCase.php
│   └── DTO/
│       ├── CreateOrderDTO.php
│       └── UpdateOrderDTO.php
│
├── Domain/                     # ドメイン層（ビジネスロジック）
│   ├── Entity/
│   │   ├── Order.php
│   │   ├── User.php
│   │   └── Menu.php
│   ├── ValueObject/
│   │   ├── OrderId.php
│   │   ├── OrderDate.php
│   │   └── OrderStatus.php
│   ├── Repository/
│   │   ├── OrderRepositoryInterface.php
│   │   ├── UserRepositoryInterface.php
│   │   └── MenuRepositoryInterface.php
│   └── Service/
│       ├── OrderDomainService.php
│       └── MenuDomainService.php
│
└── Infrastructure/             # インフラストラクチャ層
    ├── Persistence/
    │   ├── CakeOrderRepository.php
    │   ├── CakeUserRepository.php
    │   └── CakeMenuRepository.php
    └── External/
        ├── KamahoApiClient.php
        └── ExternalMenuProvider.php
```

## 実装済みコンポーネント

### Domain Layer
- ✅ Order Entity
- ✅ OrderId ValueObject
- ✅ OrderDate ValueObject
- ✅ OrderStatus ValueObject
- ✅ OrderRepositoryInterface
- ✅ OrderDomainService

### Application Layer
- ✅ CreateOrderUseCase
- ✅ UpdateOrderUseCase
- ✅ DeleteOrderUseCase
- ✅ GetOrderListUseCase
- ✅ GetOrderSummaryByDateUseCase
- ✅ CreateOrderDTO
- ✅ UpdateOrderDTO

### Infrastructure Layer
- ✅ CakeOrderRepository

### Presentation Layer
- ✅ CleanOrdersController

## 設計原則

### SOLID原則

1. **Single Responsibility Principle（単一責任の原則）**
   - 各クラスは1つの責任のみを持つ
   - UseCase は1つのユースケースのみ実装

2. **Open/Closed Principle（開放/閉鎖の原則）**
   - 拡張に対して開いている
   - 修正に対して閉じている

3. **Liskov Substitution Principle（リスコフの置換原則）**
   - インターフェースの実装は置換可能

4. **Interface Segregation Principle（インターフェース分離の原則）**
   - 必要最小限のインターフェース

5. **Dependency Inversion Principle（依存性逆転の原則）**
   - 抽象に依存し、具象に依存しない
   - RepositoryInterface がキーとなる

### DDD（Domain-Driven Design）の概念

- **Ubiquitous Language（ユビキタス言語）**: ドメインエキスパートと開発者が共通の言語を使用
- **Bounded Context（境界づけられたコンテキスト）**: ドメインモデルの適用範囲を明確化
- **Aggregate（集約）**: エンティティのグループ化と一貫性の保証

## メリット

1. **テスタビリティ**
   - ドメインロジックの独立したテスト
   - モックによるユニットテスト容易化

2. **保守性**
   - ビジネスロジックの集中管理
   - 変更の影響範囲の限定

3. **拡張性**
   - 新機能の追加が容易
   - 既存コードへの影響最小化

4. **フレームワーク非依存**
   - ドメイン層はフレームワークに依存しない
   - フレームワーク変更の影響を受けない

5. **ビジネスロジックの可視化**
   - ドメインモデルがビジネスを表現
   - コードがドキュメントになる

## 使用例

```php
// 1. DTOの作成
$dto = new CreateOrderDTO([
    'user_id' => 1,
    'menu_id' => 10,
    'quantity' => 2,
    'order_date' => '2026-03-10'
]);

// 2. リポジトリとドメインサービスの準備
$repository = new CakeOrderRepository();
$domainService = new OrderDomainService($repository);

// 3. ユースケースの実行
$useCase = new CreateOrderUseCase($repository, $domainService);
$order = $useCase->execute($dto);

// 4. 結果の取得
$orderArray = $order->toArray();
```

## 今後の拡張

- [ ] User ドメインの実装
- [ ] Menu ドメインの実装
- [ ] Supplier ドメインの実装
- [ ] イベント駆動アーキテクチャーの導入
- [ ] CQRSパターンの適用

## 参考資料

- Clean Architecture by Robert C. Martin
- Domain-Driven Design by Eric Evans
- Implementing Domain-Driven Design by Vaughn Vernon
