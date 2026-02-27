import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公開パスはスルー
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Cookieでトークン確認
  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    // ログイン後に元のURLへ戻れるようリダイレクト先を付与
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon.ico などを除外
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
