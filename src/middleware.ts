import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { shortUrlToId } from '@/utils/shortUrl'
import { handleServerError } from '@/lib/server-error-handler'

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if(pathname.length === 7) {
    try {
      const id = shortUrlToId(pathname.slice(1))
      if(id) {
        return NextResponse.redirect(new URL(`/?id=${id}`, request.url))
      }
      return NextResponse.redirect(new URL(`/`, request.url))
    } catch (error) {
      // 发送错误到飞书
      await handleServerError(
        error instanceof Error ? error : new Error(String(error)),
        {
          path: request.nextUrl.pathname,
          method: request.method,
          userAgent: request.headers.get('user-agent') || undefined,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        }
      );
      return NextResponse.redirect(new URL(`/`, request.url))
    }
  }
}
