/*
FILE:      src/core/limits.ts
CREATED:   2026-11-24 18:37 +03
TASK:      job 120 monday review board (F7)
AUTHOR:    M Alhassoun
WHAT:      Server-side input limits and checks: message, template, phone list, admin-only writes.
WHY:       the server trusted the client; oversized or non-admin writes were accepted.
USAGE:     checkMessage / checkTemplate / checkTargets return an error string or null; requireAdmin is Express middleware.
DEPENDS:   middleware/monday-jwt (AuthedRequest types)
*/
import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../middleware/monday-jwt';

// kwtSMS ERR012: message over 7 pages. 7 x 153 = 1071 GSM-7 characters is the most any message may hold
// (Unicode allows fewer, the gateway rejects those). Applied to the template text before placeholder expansion.
export const MAX_MESSAGE_CHARS = 1071;
export const MAX_TEMPLATE_NAME_CHARS = 100;
export const MAX_TARGETS = 1000; // pipeline batches in 200s; the UI selects one board's items
export const MAX_NOTIF_RECIPIENTS = 100;

export function checkMessage(body: unknown): string | null {
  if (typeof body !== 'string' || body.trim() === '') return 'message-required';
  if (body.length > MAX_MESSAGE_CHARS) return 'message-too-long';
  return null;
}

export function checkTemplate(name: unknown, body: unknown): string | null {
  if (typeof name !== 'string' || name.trim() === '') return 'template-name-required';
  if (name.length > MAX_TEMPLATE_NAME_CHARS) return 'template-name-too-long';
  if (typeof body !== 'string' || body.trim() === '') return 'template-body-required';
  if (body.length > MAX_MESSAGE_CHARS) return 'template-body-too-long';
  return null;
}

export function checkTargets(targets: unknown): string | null {
  if (!Array.isArray(targets) || targets.length === 0) return 'targets-required';
  if (targets.length > MAX_TARGETS) return 'too-many-targets';
  return null;
}

// monday session tokens carry only account_id and user_id (docs: mondayget sessionToken), so no admin flag
// is guaranteed. When a token DOES carry one (is_admin false, is_view_only or is_guest true) the write is
// refused with 403. Full enforcement needs an account-level OAuth token and a me{is_admin} query.
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const m = req.monday;
  if (m && (m.isAdmin === false || m.isViewOnly === true || m.isGuest === true)) {
    res.status(403).json({ error: 'admin-required' });
    return;
  }
  next();
}
