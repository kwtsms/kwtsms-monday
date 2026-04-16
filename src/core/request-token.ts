// Carries the raw Bearer token from the current HTTP request down through
// storage calls. The monday-apps Storage SDK uses that token as the
// Authorization header for its backend, so each request must construct
// Storage with its own token. AsyncLocalStorage keeps this off the function
// signatures while preserving per-request isolation.
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage<{ token: string }>();

export function runWithToken<T>(token: string, fn: () => T): T {
  return als.run({ token }, fn);
}

export function currentToken(): string {
  return als.getStore()?.token ?? '';
}
