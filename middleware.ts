import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("jk_token")?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");

  // Allow auth pages without token
  if (isAuthPage) {
    return NextResponse.next();
  }

  // For client-side token checking, we rely on the AuthProvider
  // This middleware just ensures the page loads
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|uploads).*)"],
};
