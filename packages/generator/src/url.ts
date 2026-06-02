/**
 * Normalize a user-supplied target into a navigable URL.
 *
 * A bare host (`example.com`) gets an `https://` scheme so `page.goto` accepts
 * it; loopback hosts default to `http://` since local dev servers rarely speak
 * TLS. An explicit scheme is always left untouched.
 */
export function normalizeUrl(input: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input;
  const isLoopback = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(input);
  return `${isLoopback ? 'http' : 'https'}://${input}`;
}
