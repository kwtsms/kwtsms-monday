import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SIGNING_SECRET = process.env.MONDAY_SIGNING_SECRET ?? '';

export interface MondayContext {
  accountId: string;
  userId: string;
  backToUrl?: string;
}

export interface AuthedRequest extends Request {
  monday?: MondayContext;
}

export function mondayAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  if (!token) {
    res.status(401).json({ error: 'missing-token' });
    return;
  }
  try {
    const payload = jwt.verify(token, SIGNING_SECRET) as any;
    req.monday = {
      accountId: String(payload.accountId ?? payload.dat?.account_id),
      userId: String(payload.userId ?? payload.dat?.user_id),
      backToUrl: payload.backToUrl,
    };
    next();
  } catch {
    res.status(401).json({ error: 'invalid-token' });
  }
}
