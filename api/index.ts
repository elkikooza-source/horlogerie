import type { Request, Response } from 'express';
import { app, ensureAppReady } from '../server.ts';

export default async function handler(req: Request, res: Response) {
  await ensureAppReady();
  return app(req, res);
}
