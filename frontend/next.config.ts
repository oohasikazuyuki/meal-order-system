import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // パフォーマンス最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 画像最適化
  images: {
    formats: ['image/webp'],
  },
  // ESM パッケージのトランスパイル（react-pdf v10 はピュア ESM）
  transpilePackages: ['react-pdf', 'pdfjs-dist'],
  // プロダクションビルドで未使用コードを削除
  experimental: {
    optimizePackageImports: ['axios'],
  },
}

export default nextConfig
