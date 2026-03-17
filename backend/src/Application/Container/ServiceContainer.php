<?php
declare(strict_types=1);

namespace App\Application\Container;

use App\Domain\Repository\OrderRepositoryInterface;
use App\Infrastructure\Persistence\CakeOrderRepository;

/**
 * 簡易DIコンテナ
 */
class ServiceContainer
{
    private static ?self $instance = null;
    private array $bindings = [];
    private array $instances = [];

    private function __construct()
    {
        $this->registerDefaultBindings();
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function registerDefaultBindings(): void
    {
        // リポジトリの登録
        $this->bind(OrderRepositoryInterface::class, CakeOrderRepository::class);
    }

    public function bind(string $interface, string $implementation): void
    {
        $this->bindings[$interface] = $implementation;
    }

    public function singleton(string $interface, string $implementation): void
    {
        $this->bind($interface, $implementation);
    }

    public function get(string $class)
    {
        // シングルトンインスタンスがあれば返す
        if (isset($this->instances[$class])) {
            return $this->instances[$class];
        }

        // バインディングがあれば解決
        if (isset($this->bindings[$class])) {
            $implementation = $this->bindings[$class];
            $instance = new $implementation();
            $this->instances[$class] = $instance;
            return $instance;
        }

        // 直接インスタンス化
        $instance = new $class();
        $this->instances[$class] = $instance;
        return $instance;
    }

    public function make(string $class)
    {
        // バインディングがあれば解決
        if (isset($this->bindings[$class])) {
            $implementation = $this->bindings[$class];
            return new $implementation();
        }

        // 直接インスタンス化
        return new $class();
    }

    public function reset(): void
    {
        $this->instances = [];
    }
}
