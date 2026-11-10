import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildContent } from './build-content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await buildContent();
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};
const assets = {};
async function collect(directory, relative = '') {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || (!relative && entry.name === 'server')) continue;
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), name);
    else if (entry.isFile() && types[path.extname(entry.name)]) {
      const bytes = await readFile(path.join(directory, entry.name));
      assets[`/${name}`] = {
        type: types[path.extname(entry.name)], data: bytes.toString('base64'), size: bytes.length,
        etag: `"${createHash('sha256').update(bytes).digest('hex')}"`
      };
    }
  }
}
await collect(path.join(root, 'dist'));
if (!assets['/index.html']) throw new Error('dist/index.html não encontrado.');
const tariffs = (await readFile(path.join(root, 'dist/published-tariffs.mjs'), 'utf8')).replace(/^export /gm, '');
const shared = (await readFile(path.join(root, 'lib/charging-api.mjs'), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const worker = (await readFile(path.join(root, 'worker/index.mjs'), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '')
  .replace('/*__ELECTRICITIES_ASSETS__*/ {}', JSON.stringify(assets));
if (!worker.includes(JSON.stringify(assets))) throw new Error('Marcador de assets não encontrado.');
const manifest = JSON.parse(await readFile(path.join(root, '.openai/hosting.json'), 'utf8'));
delete manifest.static;
await mkdir(path.join(root, 'dist/server'), { recursive: true });
await mkdir(path.join(root, 'dist/.openai'), { recursive: true });
await writeFile(path.join(root, 'dist/server/index.js'), `${tariffs}\n${shared}\n${worker}`);
await writeFile(path.join(root, 'dist/.openai/hosting.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Worker gerado com ${Object.keys(assets).length} arquivos públicos incorporados.`);
