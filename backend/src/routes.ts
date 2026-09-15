import { Router, type Response } from 'express';
import { mapWithConcurrency } from './concurrency.js';
import { AppError, publicError } from './errors.js';
import { extractWebsiteIcon } from './extractor.js';
import { parseTransformOptions, serveImage } from './image-service.js';

export const apiRouter = Router();

function sendError(response: Response, error: unknown): void {
  const safe = publicError(error);
  response.status(safe.status).json({ success: false, error: { code: safe.code, message: safe.message } });
}

apiRouter.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

apiRouter.get('/icon', async (request, response) => {
  try {
    if (typeof request.query.url !== 'string') throw new AppError('INVALID_URL', '缺少 url 查询参数。');
    response.json(await extractWebsiteIcon(request.query.url));
  } catch (error) {
    sendError(response, error);
  }
});

apiRouter.post('/icons', async (request, response) => {
  try {
    const urls = (request.body as { urls?: unknown })?.urls;
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new AppError('INVALID_BATCH', '请提供至少一个网站地址。');
    }
    if (urls.length > 20) throw new AppError('BATCH_LIMIT', '批量查询一次最多支持 20 个网站。');
    if (!urls.every((url) => typeof url === 'string')) {
      throw new AppError('INVALID_BATCH', 'urls 必须是字符串数组。');
    }
    const results = await mapWithConcurrency(urls as string[], 4, async (url) => {
      try {
        return { input: url, ...(await extractWebsiteIcon(url)) };
      } catch (error) {
        const safe = publicError(error);
        return { input: url, success: false as const, error: { code: safe.code, message: safe.message } };
      }
    });
    response.json({ success: true, results });
  } catch (error) {
    sendError(response, error);
  }
});

apiRouter.get('/proxy-icon', async (request, response) => {
  try {
    if (typeof request.query.url !== 'string') throw new AppError('INVALID_URL', '缺少 url 查询参数。');
    const options = parseTransformOptions(request.query.format, request.query.size);
    const icon = await serveImage(request.query.url, options);
    response.set({
      'Content-Type': icon.type,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(icon.body);
  } catch (error) {
    sendError(response, error);
  }
});

apiRouter.get('/download', async (request, response) => {
  try {
    if (typeof request.query.url !== 'string') throw new AppError('INVALID_URL', '缺少 url 查询参数。');
    const options = parseTransformOptions(request.query.format, request.query.size);
    const icon = await serveImage(request.query.url, options);
    const requestedDomain = typeof request.query.domain === 'string' ? request.query.domain : new URL(icon.url).hostname;
    const domain = requestedDomain.replace(/[^a-z0-9.-]/giu, '-').slice(0, 120) || 'website';
    const extension = icon.format === 'jpeg' ? 'jpg' : icon.format;
    response.set({
      'Content-Type': icon.type,
      'Content-Disposition': `attachment; filename="${domain}-icon.${extension}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(icon.body);
  } catch (error) {
    sendError(response, error);
  }
});

apiRouter.get('/convert', async (request, response) => {
  try {
    if (typeof request.query.url !== 'string') throw new AppError('INVALID_URL', '缺少 url 查询参数。');
    const options = parseTransformOptions(request.query.format, request.query.size);
    if (options.format === 'original' && options.size === null) {
      throw new AppError('CONVERSION_REQUIRED', '请至少指定 format 或 size。');
    }
    const icon = await serveImage(request.query.url, options);
    response.set({
      'Content-Type': icon.type,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(icon.body);
  } catch (error) {
    sendError(response, error);
  }
});
