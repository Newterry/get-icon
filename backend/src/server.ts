import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { apiRouter } from './routes.js';
import { rateLimit } from './rate-limit.js';

const app = express();
const port = Number(process.env.PORT ?? 3080);
const host = process.env.HOST ?? '0.0.0.0';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDir, '../../frontend/dist');

app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      // Unraid commonly serves custom containers over plain HTTP on a LAN.
      // Helmet's default upgrade directive would rewrite relative assets to
      // HTTPS and leave the Web UI blank when no TLS listener exists.
      upgradeInsecureRequests: null,
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(compression({ threshold: 1024 }));
app.use((request, response, next) => {
  const requestId = request.header('x-request-id')?.slice(0, 80) || randomUUID();
  const started = performance.now();
  response.setHeader('X-Request-Id', requestId);
  response.on('finish', () => {
    if (!request.path.startsWith('/api/')) return;
    const durationMs = Math.round(performance.now() - started);
    console.log(JSON.stringify({ requestId, method: request.method, path: request.path, status: response.statusCode, durationMs }));
  });
  next();
});
app.use(express.json({ limit: '64kb' }));
app.use('/api', rateLimit, apiRouter);
app.use(express.static(frontendDist, {
  index: 'index.html',
  maxAge: '1h',
  setHeaders(response, filePath) {
    if (/[/\\]assets[/\\].+\.[a-f0-9]{8,}\./iu.test(filePath)) {
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));
app.get('*path', (_request, response) => response.sendFile(path.join(frontendDist, 'index.html')));

app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  void _next;
  console.error('[server]', error.message);
  response.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '服务器暂时无法完成请求。' } });
});

const server = app.listen(port, host, () => {
  console.log(`[get-icon] listening on http://${host}:${port}`);
});

server.keepAliveTimeout = 5_000;
server.headersTimeout = 12_000;
server.requestTimeout = 45_000;

function shutdown(signal: string): void {
  console.log(`[get-icon] ${signal} received, draining connections`);
  server.close((error) => {
    if (error) {
      console.error('[get-icon] shutdown failed', error);
      process.exitCode = 1;
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
