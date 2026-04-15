import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// monday session tokens (from monday.get('sessionToken')) are signed with the
// app's Client Secret. Recipe webhook signatures use the Signing Secret. We
// try Client Secret first and fall back to Signing Secret so both paths work
// through this single middleware.
const CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET ?? '';
const SIGNING_SECRET = process.env.MONDAY_SIGNING_SECRET ?? '';

export interface MondayContext {
  accountId: string;
  userId: string;
  backToUrl?: string;
}

export interface AuthedRequest extends Request {
  monday?: MondayContext;
}

function verifyWith(token: string, secret: string): Record<string, unknown> | null {
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function mondayAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  if (!token) {
    res.status(401).json({ error: 'missing-token' });
    return;
  }
  const payload =
    verifyWith(token, CLIENT_SECRET) ?? verifyWith(token, SIGNING_SECRET);
  if (!payload) {
    res.status(401).json({ error: 'invalid-token' });
    return;
  }
  const dat = (payload as { dat?: { account_id?: unknown; user_id?: unknown } }).dat ?? {};
  req.monday = {
    accountId: String((payload as any).accountId ?? dat.account_id ?? ''),
    userId: String((payload as any).userId ?? dat.user_id ?? ''),
    backToUrl: (payload as any).backToUrl,
  };
  next();
}
