import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getSecret } from '../core/monday-env';

// monday session tokens (from monday.get('sessionToken')) are signed with the
// app's Client Secret. Recipe webhook signatures use the Signing Secret. We
// try Client Secret first and fall back to Signing Secret so both paths work
// through this single middleware. Secrets come from monday-code's SecretsManager
// (NOT process.env) when running on monday-code, with process.env fallback for
// local dev.

export interface MondayContext {
  accountId: string;
  userId: string;
  backToUrl?: string;
}

export interface AuthedRequest extends Request {
  monday?: MondayContext;
}

function verifyWith(token: string, secret: string): { payload: Record<string, unknown> | null; err: string | null } {
  if (!secret) return { payload: null, err: 'secret-empty' };
  try {
    const payload = jwt.verify(token, secret) as Record<string, unknown>;
    return { payload, err: null };
  } catch (e) {
    return { payload: null, err: (e as Error).message };
  }
}

export function mondayAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  if (!token) {
    res.status(401).json({ error: 'missing-token' });
    return;
  }
  const CLIENT_SECRET = getSecret('MONDAY_CLIENT_SECRET');
  const SIGNING_SECRET = getSecret('MONDAY_SIGNING_SECRET');
  const clientTry = verifyWith(token, CLIENT_SECRET);
  if (clientTry.payload) {
    const payload = clientTry.payload;
    const dat = (payload as { dat?: { account_id?: unknown; user_id?: unknown } }).dat ?? {};
    req.monday = {
      accountId: String((payload as any).accountId ?? dat.account_id ?? ''),
      userId: String((payload as any).userId ?? dat.user_id ?? ''),
      backToUrl: (payload as any).backToUrl,
    };
    next();
    return;
  }
  const signingTry = verifyWith(token, SIGNING_SECRET);
  if (signingTry.payload) {
    const payload = signingTry.payload;
    const dat = (payload as { dat?: { account_id?: unknown; user_id?: unknown } }).dat ?? {};
    req.monday = {
      accountId: String((payload as any).accountId ?? dat.account_id ?? ''),
      userId: String((payload as any).userId ?? dat.user_id ?? ''),
      backToUrl: (payload as any).backToUrl,
    };
    next();
    return;
  }
  const header = (() => {
    try {
      return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    } catch {
      return null;
    }
  })();
  res.status(401).json({
    error: 'invalid-token',
    debug: {
      tokenHeader: header,
      clientSecretPresent: !!CLIENT_SECRET,
      signingSecretPresent: !!SIGNING_SECRET,
      clientSecretErr: clientTry.err,
      signingSecretErr: signingTry.err,
    },
  });
}
