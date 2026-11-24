/*
FILE:      src/core/log-path.ts
CREATED:   2026-11-24 18:37 +03
TASK:      job 120 monday review board (F5)
AUTHOR:    integration agent
WHAT:      logPath(req): request path without the query string, for the request logger.
WHY:       req.originalUrl on /oauth/callback carries ?code=..., which was written to the logs.
USAGE:     const p = logPath(req)
DEPENDS:   nothing
*/
export function logPath(req: { originalUrl?: string; url?: string }): string {
  const u = req.originalUrl ?? req.url ?? '';
  const q = u.indexOf('?');
  return q === -1 ? u : u.slice(0, q);
}
