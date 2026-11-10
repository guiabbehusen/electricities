import { applyPublishedTariffs } from '../dist/published-tariffs.mjs';

const cacheLifetime = 5 * 60 * 1000;
const maximumResults = 500;

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

const monetaryPattern = '(?:(?:BRL|R\\$)\\s*(\\d+(?:[.,]\\d+)?)(?![\\d.,])|(\\d+(?:[.,]\\d+)?)(?![\\d.,])\\s*(?:BRL|R\\$))';

function publishedAmounts(text, energy = false) {
  const unit = energy ? '\\s*(?:/|per|por)\\s*kWh\\b' : '';
  return [...text.matchAll(new RegExp(monetaryPattern + unit, 'gi'))].map(match => ({
    amount: Number((match[1] ?? match[2]).replace(',', '.')),
    start: match.index,
    end: match.index + match[0].length
  }));
}

function tariffForCurrent(raw, current) {
  const text = raw.replace(/\b(?:AC\s*[/+]\s*DC|DC\s*[/+]\s*AC)\b/gi, '');
  const labels = [...text.matchAll(/\b(AC|DC)\b\s*(?::\s*|(?=(?:R\$|BRL)\s*\d))/gi)];
  if (labels.length) {
    const matching = labels.filter(label => label[1].toUpperCase() === current);
    if (matching.length !== 1) return null;
    const label = matching[0];
    const nextLabel = labels[labels.indexOf(label) + 1];
    return text.slice(label.index + label[0].length, nextLabel?.index ?? text.length);
  }
  const rates = publishedAmounts(text, true);
  const labeledRates = rates.flatMap(rate => {
    const label = text.slice(rate.end).match(/^\s*\(?\s*(AC|DC)\b/i);
    return label ? [{ rate, current: label[1].toUpperCase() }] : [];
  });
  if (!labeledRates.length) return text;
  const matching = labeledRates.filter(rate => rate.current === current);
  if (matching.length !== 1) return null;
  const rate = matching[0].rate;
  return text.slice(rate.start, rates[rates.indexOf(rate) + 1]?.start ?? text.length);
}

export function parsePublishedTariff(raw, current) {
  const unknown = { pricePerKwh: null, activationFee: null, canEstimateCost: false };
  if (!raw || typeof raw !== 'string') return unknown;
  const text = tariffForCurrent(raw, current);
  if (text === null) return unknown;
  const normalized = text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const context = raw.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const conditional = /\b(?:desconto|discount|promocao|promocional|a partir|desde|ate|entre|horario|horarios|noturno|diurno|trial|trials|teste|testes|hospedes?|clientes?|membros?|assinantes?|members?|guests?|subscribers?|antigo|anterior|old|futuro|futura|se|caso|when|while|apenas|somente|exceto|except|domingos?|segundas?|tercas?|quartas?|quintas?|sextas?|sabados?|feriados?|weekdays?|weekends?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}h(?:\d{2})?\b|\b20\d{2}\b/.test(context);
  if (/^(?:free(?: charging| to use)?|gratis|gratuit[oa]|sem custo|sem cobranca)[.!]?\s*$/.test(normalized.trim())) {
    return { pricePerKwh: 0, activationFee: 0, canEstimateCost: !conditional };
  }

  const fixedSession = text.match(new RegExp('^\\s*' + monetaryPattern + '\\s*(?:/|por|per)\\s*(?:recarga|sess[aã]o|session|charge)\\s*[.!]?\\s*$', 'i'));
  if (fixedSession) return { pricePerKwh: null, activationFee: Number((fixedSession[1] ?? fixedSession[2]).replace(',', '.')), canEstimateCost: !conditional };

  const rates = publishedAmounts(text, true);
  if (rates.length !== 1) return unknown;
  const rate = rates[0];
  const extras = publishedAmounts(text).filter(amount => amount.start < rate.start || amount.end > rate.end);
  let activationFee = 0;
  if (extras.length === 1) {
    const extra = extras[0];
    const around = normalized.slice(Math.max(0, extra.start - 35), extra.end + 35);
    const extraHasUnit = /^\s*(?:\/|por|per)\s*(?:min(?:uto)?s?|h(?:ora)?s?|kwh|kw)\b/i.test(text.slice(extra.end));
    const between = extra.end <= rate.start ? text.slice(extra.end, rate.start) : text.slice(rate.end, extra.start);
    const fixedLabel = /\b(?:ativacao|inicio|inicial|taxa fixa|flat fee|activation fee|start fee|session fee)\b|(?:por|\/)\s*(?:recarga|sessao|session|charge)\b/.test(around);
    const otherFee = /\b(?:ociosidade|parking|estacionamento)\b/.test(around);
    if (!extraHasUnit && (fixedLabel || (!otherFee && /^\s*\+\s*$/.test(between)))) activationFee = extra.amount;
    else activationFee = null;
  } else if (extras.length > 1) {
    activationFee = null;
  }
  const unsupportedTime = /(?:\/|por|per)\s*(?:min(?:uto)?s?|h(?:ora)?s?)\b|\b(?:ociosidade|parking|estacionamento|por tempo)\b/.test(normalized);
  const unspecifiedFee = extras.length === 0 && /\b(?:extras?|adiciona(?:l|is)|ativacao|fees?|taxa fixa)\b|\+/.test(normalized);
  const describedValues = [rate, ...extras].sort((first, second) => second.start - first.start);
  const remainder = describedValues.reduce((value, amount) => value.slice(0, amount.start) + value.slice(amount.end), text);
  return {
    pricePerKwh: rate.amount,
    activationFee,
    canEstimateCost: !conditional && !unsupportedTime && !unspecifiedFee && activationFee !== null && !/\d/.test(remainder)
  };
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
  return applyPublishedTariffs(records.flatMap(record => {
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
      ...parsePublishedTariff(rawTariff, connector?.current),
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
  }));
}

export function parseBounds(value) {
  const parts = typeof value === 'string' ? value.split(',') : [];
  if (parts.length !== 4 || parts.some(part => !part.trim())) return null;
  const [south, west, north, east] = parts.map(Number);
  if (![south, west, north, east].every(Number.isFinite)) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180 || south >= north || west >= east) return null;
  return [south, west, north, east];
}

function jsonResponse(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}

export function createChargingApi({ apiKey, fetchImpl = fetch, now = Date.now } = {}) {
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
          redirect: 'manual', signal: controller.signal
        });
        if (!upstream.ok) console.warn('Open Charge Map upstream HTTP status:', upstream.status);
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
        const diagnostic = String(error?.message || 'Unknown upstream failure');
        const diagnosticName = String(error?.name || 'Error');
        console.error('Open Charge Map query failed:', {
          name: (key ? diagnosticName.replaceAll(key, '[REDACTED]') : diagnosticName).replace(/[\r\n]/g, ' ').slice(0, 80),
          message: (key ? diagnostic.replaceAll(key, '[REDACTED]') : diagnostic).replace(/[\r\n]/g, ' ').slice(0, 320)
        });
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

  return async function handleApi(request) {
    try {
      const url = new URL(request.url);
      if (request.method !== 'GET') {
        return jsonResponse(405, { error: { code: 'method_not_allowed', message: 'Use uma consulta GET.' } }, { Allow: 'GET' });
      }
      if (request.headers.get('sec-fetch-site') === 'cross-site') {
        return jsonResponse(403, { error: { code: 'origin_not_allowed', message: 'Abra a consulta pelo Eletricities.' } });
      }
      if (url.pathname === '/api/data-sources') {
        return jsonResponse(200, { openChargeMap: { configured, registrationUrl: 'https://openchargemap.org/develop/api' } });
      }
      if (url.pathname !== '/api/charging-stations') {
        return jsonResponse(404, { error: { code: 'not_found', message: 'Consulta não encontrada.' } });
      }
      const bounds = parseBounds(url.searchParams.get('bbox'));
      if (!bounds) {
        return jsonResponse(400, { error: { code: 'invalid_bounds', message: 'Informe os limites válidos da região da rota.' } });
      }
      if (!configured) {
        return jsonResponse(503, { error: { code: 'source_not_configured', message: 'A API gratuita do Open Charge Map ainda precisa de uma chave no servidor.' } });
      }
      return jsonResponse(200, await queryStations(bounds));
    } catch (error) {
      return jsonResponse(error instanceof SourceError ? error.status : 500, {
        error: { code: error instanceof SourceError ? error.code : 'source_unavailable', message: error instanceof SourceError ? error.message : 'Não foi possível consultar as estações agora.' }
      });
    }
  };
}
