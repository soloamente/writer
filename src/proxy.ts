import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Proxy (formerly middleware) for handling authentication and route protection.
 * 
 * This runs before route rendering and:
 * - Protects /editor/* routes by checking authentication
 * - Redirects unauthenticated users to /sign-in
 * - Allows public routes (/, /sign-in, /sign-up, /api/auth/*) to pass through
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes to pass through
  const publicRoutes = [
    "/",
    "/sign-in",
    "/sign-up",
    "/api/auth",
  ];

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Allow public routes and static files to pass through
  if (
    isPublicRoute ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Protect /editor/* routes
  if (pathname.startsWith("/editor")) {
    try {
      // Check if user is authenticated
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      // If no session, redirect to sign-in
      // Preserve the original URL as a query parameter for redirect after login
      if (!session?.user) {
        const signInUrl = new URL("/sign-in", request.url);
        signInUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(signInUrl);
      }
    } catch (error) {
      // If auth check fails, redirect to sign-in
      console.error("Auth check failed in proxy:", error);
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Allow the request to proceed
  return NextResponse.next();
}

/**
 * Configure which paths the proxy should run on.
 * We exclude static files, Next.js internals, and API auth routes.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (Better Auth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};



