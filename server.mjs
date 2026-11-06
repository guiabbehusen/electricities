import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(projectDirectory, 'dist');
const cacheLifetime = 5 * 60 * 1000;
const maximumResults = 500;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

class SourceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isoDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function pricePerKilowattHour(raw) {
  if (!raw) return null;
  const price = raw.match(/^\s*(?:(?:BRL|R\$)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:BRL|R\$))\s*(?:\/|per|por)\s*kWh\s*[.]?\s*$/i);
  if (price) return Number((price[1] ?? price[2]).replace(',', '.'));
  return /^(?:free(?: charging| to use)?|gr[aá]tis|gratuit[oa]|sem custo|sem cobran[cç]a)[.!]?$/i.test(raw.trim()) ? 0 : null;
}

function connectionDetails(connection) {
  const id = connection.ConnectionTypeID ?? connection.ConnectionType?.ID;
  const known = {
    33: { connector: 'CCS2', current: 'DC', priority: 2 },
    25: { connector: 'Tipo 2', current: 'AC', priority: 1 },
    1036: { connector: 'Tipo 2', current: 'AC', priority: 1 }
  }[id];
  const powerKw = Number.isFinite(connection.PowerKW) && connection.PowerKW > 0 ? connection.PowerKW : null;
  return {
    connector: known?.connector ?? connection.ConnectionType?.Title ?? null,
    current: known?.current ?? null,
    powerKw,
    priority: known?.priority ?? 0
  };
}

export function normalizeOpenChargeMapStations(records, fetchedAt) {
  return records.flatMap(record => {
    if (!record || typeof record !== 'object') return [];
    const address = record.AddressInfo;
    const usageType = record.UsageTypeID ?? record.UsageType?.ID;
    if (!Number.isInteger(record.ID) || !address || ![1, 4, 5, 7].includes(usageType)) return [];
    if (record.SubmissionStatus?.IsLive === false || record.StatusType?.IsOperational === false) return [];
    if (address.Country?.ISOCode && String(address.Country.ISOCode).toUpperCase() !== 'BR') return [];
    const latitude = address.Latitude;
    const longitude = address.Longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];

    const connections = (Array.isArray(record.Connections) ? record.Connections : [])
      .filter(connection => connection && typeof connection === 'object' && connection.StatusType?.IsOperational !== false)
      .map(connectionDetails)
      .sort((first, second) => second.priority - first.priority || (second.powerKw ?? 0) - (first.powerKw ?? 0));
    const connector = connections[0];
    const rawTariff = typeof record.UsageCost === 'string' ? record.UsageCost.trim() : '';
    const provider = record.DataProvider ?? {};
    return [{
      id: `ocm-${record.ID}`,
      name: address.Title || record.OperatorInfo?.Title || 'Estação de recarga',
      address: [address.AddressLine1, address.Town, address.StateOrProvince].filter(Boolean).join(' · ') || 'Localização no mapa',
      latitude,
      longitude,
      powerKw: connector?.powerKw ?? null,
      connector: connector?.connector ?? null,
      current: connector?.current ?? null,
      access: usageType === 4 ? 'membership' : usageType === 7 ? 'notice' : 'yes',
      pricePerKwh: pricePerKilowattHour(rawTariff),
      tariffDetails: rawTariff ? [{ label: 'Tarifa publicada para o local', value: rawTariff }] : [],
      isLive: true,
      ocmUrl: `https://openchargemap.org/poi/details/${record.ID}`,
      providerName: provider.Title || 'Open Charge Map',
      providerUrl: safeUrl(provider.WebsiteURL) || 'https://openchargemap.org/',
      providerLicense: typeof provider.License === 'string' ? provider.License : null,
      operatorName: record.OperatorInfo?.Title || null,
      sourceUpdatedAt: isoDate(record.DateLastStatusUpdate),
      lastVerifiedAt: isoDate(record.DateLastVerified),
      fetchedAt
    }];
  });
}

export function parseBounds(value) {
  const parts = typeof value === 'string' ? value.split(',') : [];
  if (parts.length !== 4 || parts.some(part => !part.trim())) return null;
  const [south, west, north, east] = parts.map(Number);
  if (![south, west, north, east].every(Number.isFinite)) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180 || south >= north || west >= east) return null;
  return [south, west, north, east];
}

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
  const filename = path.resolve(publicDirectory, relative);
  if (!filename.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(403).end('Acesso negado.');
    return;
  }
  try {
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

export function createAppServer({ apiKey = process.env.OPEN_CHARGE_MAP_API_KEY, fetchImpl = fetch, now = Date.now } = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  const configured = Boolean(key) && !/[\r\n]/.test(key);
  const cache = new Map();
  const pending = new Map();

  async function queryStations(bounds) {
    const cacheKey = bounds.join(',');
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now()) return cached.data;
    if (pending.has(cacheKey)) return pending.get(cacheKey);
    const operation = (async () => {
      const [south, west, north, east] = bounds;
      const params = new URLSearchParams({
        output: 'json', countrycode: 'BR', opendata: 'true', compact: 'false', verbose: 'true',
        maxresults: String(maximumResults), client: 'eletricities',
        boundingbox: `(${north},${west}),(${south},${east})`
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const upstream = await fetchImpl(`https://api.openchargemap.io/v3/poi/?${params}`, {
          headers: { 'X-API-Key': key, Accept: 'application/json', 'User-Agent': 'Eletricities/1.0' },
          redirect: 'error', signal: controller.signal
        });
        if ([401, 403].includes(upstream.status)) throw new SourceError(502, 'source_auth_failed', 'A chave da fonte gratuita precisa ser verificada na configuração do servidor.');
        if (upstream.status === 429) throw new SourceError(503, 'source_rate_limited', 'A fonte gratuita atingiu o limite de consultas. Tente novamente mais tarde.');
        if (!upstream.ok) throw new SourceError(502, 'source_unavailable', 'A fonte de estações está temporariamente indisponível.');
        const records = await upstream.json();
        if (!Array.isArray(records)) throw new SourceError(502, 'source_unavailable', 'A fonte de estações retornou uma resposta inválida.');
        const fetchedAt = new Date(now()).toISOString();
        const data = { source: 'openchargemap', fetchedAt, limited: records.length >= maximumResults, stations: normalizeOpenChargeMapStations(records, fetchedAt) };
        cache.set(cacheKey, { expiresAt: now() + cacheLifetime, data });
        for (const [entryKey, entry] of cache) if (entry.expiresAt <= now()) cache.delete(entryKey);
        if (cache.size > 50) cache.delete(cache.keys().next().value);
        return data;
      } catch (error) {
        if (error instanceof SourceError) throw error;
        if (controller.signal.aborted) throw new SourceError(504, 'source_timeout', 'A fonte de estações demorou para responder. Tente novamente.');
        throw new SourceError(502, 'source_unavailable', 'A fonte de estações está temporariamente indisponível.');
      } finally {
        clearTimeout(timer);
      }
    })();
    pending.set(cacheKey, operation);
    try {
      return await operation;
    } finally {
      pending.delete(cacheKey);
    }
  }

  return createServer(async (request, response) => {
    try {
      const host = new URL(`http://${request.headers.host}`).hostname;
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
        sendJson(response, 403, { error: { code: 'origin_not_allowed', message: 'Abra a consulta pelo Eletricities local.' } });
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
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Use uma consulta GET.' } });
        return;
      }
      if (request.headers['sec-fetch-site'] === 'cross-site') {
        sendJson(response, 403, { error: { code: 'origin_not_allowed', message: 'Abra a consulta pelo Eletricities.' } });
        return;
      }
      if (url.pathname === '/api/data-sources') {
        sendJson(response, 200, { openChargeMap: { configured, registrationUrl: 'https://openchargemap.org/develop/api' } });
        return;
      }
      if (url.pathname !== '/api/charging-stations') {
        sendJson(response, 404, { error: { code: 'not_found', message: 'Consulta não encontrada.' } });
        return;
      }
      const bounds = parseBounds(url.searchParams.get('bbox'));
      if (!bounds) {
        sendJson(response, 400, { error: { code: 'invalid_bounds', message: 'Informe os limites válidos da região da rota.' } });
        return;
      }
      if (!configured) {
        sendJson(response, 503, { error: { code: 'source_not_configured', message: 'A API gratuita do Open Charge Map ainda precisa de uma chave no servidor.' } });
        return;
      }
      sendJson(response, 200, await queryStations(bounds));
    } catch (error) {
      sendJson(response, error instanceof SourceError ? error.status : 500, {
        error: { code: error instanceof SourceError ? error.code : 'source_unavailable', message: error instanceof SourceError ? error.message : 'Não foi possível consultar as estações agora.' }
      });
    }
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PORT || 8766);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT deve ser uma porta válida entre 1 e 65535.');
  const server = createAppServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `A porta ${port} está em uso. Configure outra porta em PORT.` : 'Não foi possível iniciar o servidor local.');
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`Eletricities disponível em http://127.0.0.1:${port}`));
}
