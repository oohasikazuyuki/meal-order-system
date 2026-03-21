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
  // pdfjs-dist が canvas (Node.js ネイティブ) を要求するのを抑制
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
  // プロダクションビルドで未使用コードを削除
  experimental: {
    optimizePackageImports: ['axios'],
  },
}

export default nextConfig
