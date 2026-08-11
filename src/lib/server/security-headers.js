/**
 * Baseline security headers for every response (dev + prod Bun).
 * Production Caddy mirrors most of these; CSP stays Report-Only until tuned.
 */

export const CSP_REPORT_ONLY = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com data:",
	"img-src 'self' data: blob: https:",
	"media-src 'self' blob:",
	"connect-src 'self' https://api.stripe.com https://*.stripe.com https://challenges.cloudflare.com ws: wss:",
	"worker-src 'self' blob:",
	"child-src 'self' blob:",
	'frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://challenges.cloudflare.com',
	"object-src 'none'",
	"base-uri 'self'",
	"frame-ancestors 'none'",
	"form-action 'self' https://checkout.stripe.com https://billing.stripe.com"
].join('; ');

/**
 * @type {import('@sveltejs/kit').Handle}
 */
export const handleSecurityHeaders = async ({ event, resolve }) => {
	const response = await resolve(event);
	const headers = response.headers;

	if (!headers.has('x-content-type-options')) {
		headers.set('X-Content-Type-Options', 'nosniff');
	}
	if (!headers.has('x-frame-options')) {
		headers.set('X-Frame-Options', 'DENY');
	}
	if (!headers.has('referrer-policy')) {
		headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	}
	if (!headers.has('permissions-policy')) {
		headers.set(
			'Permissions-Policy',
			'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
		);
	}
	if (!headers.has('content-security-policy-report-only')) {
		headers.set('Content-Security-Policy-Report-Only', CSP_REPORT_ONLY);
	}

	return response;
};
