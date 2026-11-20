import type { Request, Response } from 'express';
import { app, ensureAppReady } from '../server';

export default async function handler(req: Request, res: Response) {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const apiPath = urlObj.searchParams.get('__api_path');
  if (apiPath !== null) {
    urlObj.searchParams.delete('__api_path');
    const qs = urlObj.searchParams.toString();
    req.url = `/api/${apiPath}${qs ? `?${qs}` : ''}`;
  }

  await ensureAppReady();
  return app(req, res);
}
