<?php
namespace App\Controller\Api;

use App\Application\Container\ServiceContainer;
use App\Application\DTO\CreateOrderDTO;
use App\Application\DTO\UpdateOrderDTO;
use App\Application\Exception\ApplicationException;
use App\Application\Exception\InputValidationException;
use App\Application\UseCase\CreateOrderUseCase;
use App\Application\UseCase\DeleteOrderUseCase;
use App\Application\UseCase\GetOrderListUseCase;
use App\Application\UseCase\GetOrderSummaryByDateUseCase;
use App\Application\UseCase\UpdateOrderUseCase;
use App\Controller\AppController;
use App\Service\OrderService as LegacyOrderService;
use App\Domain\Exception\DomainException;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\Service\OrderDomainService;
use App\Domain\ValueObject\OrderId;

/**
 * 発注管理API
 * クリーンアーキテクチャー版
 */
class OrdersController extends AppController
{
    private OrderRepositoryInterface $orderRepository;
    private OrderDomainService $orderDomainService;
    private ServiceContainer $container;
    private LegacyOrderService $legacyOrderService;

    public function initialize(): void
    {
        parent::initialize();
        
        // DIコンテナから依存性を解決
        $this->container = ServiceContainer::getInstance();
        $this->orderRepository = $this->container->get(OrderRepositoryInterface::class);
        $this->orderDomainService = new OrderDomainService($this->orderRepository);
        $this->legacyOrderService = new LegacyOrderService();
    }

    /** GET /api/orders - 発注一覧 */
    public function index(): void
    {
        try {
            $this->set([
                'success' => true,
                'orders' => $this->legacyOrderService->getOrderList()
            ]);
            $this->viewBuilder()->setOption('serialize', ['success', 'orders']);
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** GET /api/orders/:id - 発注詳細 */
    public function view(int $id): void
    {
        try {
            $order = $this->legacyOrderService->getOrderById($id);
            if (!$order) throw new DomainException('発注が見つかりません', 404);

            $this->set([
                'success' => true,
                'order' => $order
            ]);
            $this->viewBuilder()->setOption('serialize', ['success', 'order']);
        } catch (DomainException $e) {
            $this->handleError($e, (int)$e->getCode());
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** POST /api/orders - 発注登録 */
    public function add(): void
    {
        try {
            $dto = new CreateOrderDTO($this->request->getData());
            
            $useCase = new CreateOrderUseCase($this->orderRepository, $this->orderDomainService);
            $order = $useCase->execute($dto);

            $this->response = $this->response->withStatus(201);
            $this->set([
                'success' => true,
                'order' => $order->toArray()
            ]);
            $this->viewBuilder()->setOption('serialize', ['success', 'order']);
        } catch (InputValidationException $e) {
            $this->handleValidationError($e, 400);
        } catch (DomainException $e) {
            $this->handleError($e, (int)$e->getCode());
        } catch (ApplicationException $e) {
            $this->handleError($e, (int)$e->getCode());
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** PUT /api/orders/:id - 発注更新 */
    public function edit(int $id): void
    {
        try {
            $result = $this->legacyOrderService->updateOrder($id, $this->request->getData());
            if (!$result['success']) {
                $this->response = $this->response->withStatus(400);
                $this->set(['success' => false, 'errors' => $result['errors']]);
                $this->viewBuilder()->setOption('serialize', ['success', 'errors']);
                return;
            }
            $this->set(['success' => true, 'order' => $result['entity']]);
            $this->viewBuilder()->setOption('serialize', ['success', 'order']);
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** DELETE /api/orders/:id - 発注削除 */
    public function delete(int $id): void
    {
        try {
            $this->legacyOrderService->deleteOrder($id);
            $this->set(['success' => true]);
            $this->viewBuilder()->setOption('serialize', ['success']);
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** GET /api/orders/summary - 日別発注サマリー */
    public function summary(): void
    {
        try {
            $date = $this->request->getQuery('date', date('Y-m-d'));

            $this->set([
                'success' => true,
                'orders' => $this->legacyOrderService->getOrderSummaryByDate($date)
            ]);
            $this->viewBuilder()->setOption('serialize', ['success', 'orders']);
        } catch (\InvalidArgumentException $e) {
            $this->handleError($e, 400);
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /**
     * バリデーションエラー処理
     */
    private function handleValidationError(InputValidationException $e, int $statusCode): void
    {
        $this->response = $this->response->withStatus($statusCode);
        $this->set([
            'success' => false,
            'message' => $e->getMessage(),
            'errors' => $e->getErrors()
        ]);
        $this->viewBuilder()->setOption('serialize', ['success', 'message', 'errors']);
    }

    /**
     * エラーハンドリング
     */
    private function handleError(\Exception $e, int $statusCode): void
    {
        $this->response = $this->response->withStatus($statusCode);
        $this->set([
            'success' => false,
            'message' => $e->getMessage(),
            'error' => [
                'type' => (new \ReflectionClass($e))->getShortName(),
                'code' => $e->getCode()
            ]
        ]);
        $this->viewBuilder()->setOption('serialize', ['success', 'message', 'error']);
    }
}
