import { createChargingApi } from '../lib/charging-api.mjs';

// The build replaces this marker with the public dist files. Secrets are runtime-only.
const publicAssets = /*__ELECTRICITIES_ASSETS__*/ {};

export function createWorker({ fetchImpl = fetch, now = Date.now, assets = publicAssets } = {}) {
  let activeKey;
  let handleApi;
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        if (!handleApi || activeKey !== env.OPEN_CHARGE_MAP_API_KEY) {
          activeKey = env.OPEN_CHARGE_MAP_API_KEY;
          handleApi = createChargingApi({ apiKey: activeKey, fetchImpl, now });
        }
        return handleApi(request);
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        return new Response('Caminho inválido.', { status: 400 });
      }
      if (pathname.split(/[\\/]/).some(segment => segment.startsWith('.'))) {
        return new Response('Acesso negado.', { status: 403 });
      }
      if (pathname.endsWith('/index.html') && assets[pathname]) {
        const canonical = new URL(url);
        canonical.pathname = pathname.slice(0, -'index.html'.length);
        return Response.redirect(canonical.href, 301);
      }
      if (!pathname.endsWith('/') && assets[`${pathname}/index.html`]) {
        const canonical = new URL(url);
        canonical.pathname = `${pathname}/`;
        return Response.redirect(canonical.href, 301);
      }
      const asset = assets[pathname.endsWith('/') ? `${pathname}index.html` : pathname];
      if (!asset) return new Response('Página não encontrada. Volte para https://eletricities.com/', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
      const headers = {
        'Content-Type': asset.type,
        'Cache-Control': asset.type.startsWith('text/html') ? 'no-cache' : 'public, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        ...(asset.etag ? { ETag: asset.etag } : {})
      };
      if (asset.etag && request.headers.get('If-None-Match')?.split(',').some(value => value.trim().replace(/^W\//, '') === asset.etag || value.trim() === '*')) {
        return new Response(null, { status: 304, headers });
      }
      if (asset.size !== undefined) headers['Content-Length'] = String(asset.size);
      const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.data), character => character.charCodeAt(0));
      return new Response(body, {
        headers
      });
    }
  };
}

export default createWorker();
