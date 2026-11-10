import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createChargingApi } from './lib/charging-api.mjs';
export { parsePublishedTariff, normalizeOpenChargeMapStations, parseBounds } from './lib/charging-api.mjs';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(projectDirectory, 'dist');
const localHosts = ['127.0.0.1', 'localhost', '[::1]'];
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(data));
}

async function serveStatic(request, response, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end('Caminho inválido.');
    return;
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  if (relative.split(/[\\/]/).some(segment => segment.startsWith('.'))) {
    response.writeHead(403).end('Acesso negado.');
    return;
  }
  let filename = path.resolve(publicDirectory, relative);
  if (!filename.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(403).end('Acesso negado.');
    return;
  }
  try {
    if (decoded.endsWith('/index.html')) {
      const canonical = new URL(request.url, 'http://127.0.0.1');
      canonical.pathname = decoded.slice(0, -'index.html'.length);
      response.writeHead(301, { Location: canonical.pathname + canonical.search }).end();
      return;
    }
    if ((await stat(filename)).isDirectory()) {
      if (!decoded.endsWith('/')) {
        const canonical = new URL(request.url, 'http://127.0.0.1');
        canonical.pathname = `${decoded}/`;
        response.writeHead(301, { Location: canonical.pathname + canonical.search }).end();
        return;
      }
      filename = path.join(filename, 'index.html');
    }
    const [root, resolved] = await Promise.all([realpath(publicDirectory), realpath(filename)]);
    if (!resolved.startsWith(`${root}${path.sep}`) || !(await stat(resolved)).isFile()) {
      response.writeHead(404).end('Arquivo não encontrado.');
      return;
    }
    const details = await stat(resolved);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
      'Content-Length': details.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = createReadStream(resolved);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch {
    response.writeHead(404).end('Arquivo não encontrado.');
  }
}

function allowedHostnames(value) {
  const hosts = new Set(localHosts);
  for (const entry of (value || '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean)) {
    if (!/^(?:\[[0-9a-f:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/.test(entry)) {
      throw new Error('ALLOWED_HOSTS deve conter apenas nomes de domínio ou endereços IP separados por vírgula, sem portas.');
    }
    if (!entry.startsWith('[') && (entry.length > 253 || !entry.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) {
      throw new Error('ALLOWED_HOSTS contém um nome de host inválido.');
    }
    const parsed = new URL(`http://${entry}`);
    if (parsed.hostname !== entry) throw new Error('ALLOWED_HOSTS contém um nome de host inválido.');
    hosts.add(entry);
  }
  return hosts;
}

function requestHostname(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i);
  if (!match) return null;
  try {
    const host = new URL(`http://${value}`).hostname.toLowerCase();
    return host === match[1].toLowerCase() ? host : null;
  } catch {
    return null;
  }
}

export function createAppServer({ apiKey = process.env.OPEN_CHARGE_MAP_API_KEY, allowedHosts = process.env.ALLOWED_HOSTS, fetchImpl = fetch, now = Date.now } = {}) {
  const hosts = allowedHostnames(allowedHosts);
  const handleApi = createChargingApi({ apiKey, fetchImpl, now });
  return createServer(async (request, response) => {
    try {
      const host = requestHostname(request.headers.host);
      if (!host || !hosts.has(host)) {
        sendJson(response, 403, { error: { code: 'origin_not_allowed', message: 'Abra a consulta pelo endereço configurado do Eletricities.' } });
        return;
      }
      const url = new URL(request.url, 'http://127.0.0.1');
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method)) {
          response.writeHead(405, { Allow: 'GET, HEAD' }).end();
          return;
        }
        await serveStatic(request, response, url.pathname);
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const result = await handleApi(new Request(url, { method: request.method, headers }));
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      sendJson(response, 500, { error: { code: 'source_unavailable', message: 'Não foi possível consultar as estações agora.' } });
    }
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PORT || 8766);
  const host = process.env.HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT deve ser uma porta válida entre 1 e 65535.');
  const server = createAppServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `A porta ${port} está em uso. Configure outra porta em PORT.` : 'Não foi possível iniciar o servidor local.');
    process.exitCode = 1;
  });
  server.listen(port, host, () => console.log(`Eletricities disponível em http://${host}:${port}`));
}
