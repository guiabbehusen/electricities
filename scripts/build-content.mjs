import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vehicles } from '../dist/vehicles.mjs';
import { tariffReferences } from '../dist/tariff-estimates.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://eletricities.com';
const modifiedAt = '2026-11-09';
const stylesheet = '/style.css?v=20261109-content';
const moneyFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const numeric = value => Number.isFinite(value) ? numberFormat.format(value) : 'Não informado';
const money = value => moneyFormat.format(value);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))
  ? String(value).split('-').reverse().join('/') : 'Não informada';
const jsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
const scriptData = value => `<script type="application/ld+json">${jsonLd(value)}</script>`;

function sourceLink(value, label) {
  let url;
  try { url = new URL(value); } catch { return 'Fonte não informada'; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return 'Fonte não informada';
  return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || 'Consultar fonte')}</a>`;
}

function capacityBasis(value) {
  const text = String(value ?? '').toLowerCase();
  if (/usable|util|útil/.test(text)) return 'capacidade útil';
  if (/nominal|gross|bruta/.test(text)) return 'capacidade nominal/bruta publicada';
  return 'capacidade publicada; base útil/nominal não especificada';
}

function meanReferences(references, current) {
  const sample = references.filter(reference => reference.current === current &&
    Number.isFinite(reference.pricePerKwh) && reference.pricePerKwh > 0);
  if (!sample.length) return null;
  const prices = sample.map(reference => reference.pricePerKwh);
  const dates = sample.map(reference => reference.checkedAt).filter(Boolean).sort();
  return {
    current, count: sample.length,
    mean: Math.round((prices.reduce((sum, value) => sum + value, 0) / prices.length + Number.EPSILON) * 100) / 100,
    min: Math.min(...prices), max: Math.max(...prices),
    oldest: dates[0], newest: dates.at(-1)
  };
}

function benchmarkTable(references) {
  const rows = ['AC', 'DC'].map(current => meanReferences(references, current)).filter(Boolean).map(sample => `
    <tr><th scope="row">${sample.current}</th><td><strong>${escapeHtml(money(sample.mean))}/kWh</strong><br>média estimada de referência</td><td>${sample.count}</td><td>${escapeHtml(money(sample.min))} a ${escapeHtml(money(sample.max))}/kWh</td><td>${date(sample.oldest)} a ${date(sample.newest)}</td></tr>`).join('');
  return `<div class="data-table-wrap" role="region" aria-label="Tabela com rolagem horizontal" tabindex="0"><table class="data-table">
    <caption>Média de energia calculada sobre as referências publicadas abaixo. Não é uma pesquisa nacional nem a tarifa confirmada de uma estação.</caption>
    <thead><tr><th scope="col">Tipo</th><th scope="col">Média de energia</th><th scope="col">Amostra (n)</th><th scope="col">Faixa observada</th><th scope="col">Datas de conferência</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function tariffTable(references, compact = false) {
  const rows = references.map(reference => {
    const fixedFee = Number.isFinite(reference.activationFee)
      ? `${money(reference.activationFee)} por sessão` : 'Não detalhada na referência';
    const dates = [
      `Conferência: ${date(reference.checkedAt)}`,
      reference.publishedAt ? `Publicação: ${date(reference.publishedAt)}` : null,
      reference.effectiveFrom ? `Vigência desde ${date(reference.effectiveFrom)}` : null
    ].filter(Boolean).join(' · ');
    return `<tr><th scope="row">${escapeHtml(reference.operator)}<br><span class="reference-meta">${escapeHtml(reference.scope)}</span></th>
      <td>${escapeHtml(reference.current)}</td><td>${escapeHtml(money(reference.pricePerKwh))}/kWh</td>
      ${compact ? '' : `<td>${escapeHtml(fixedFee)}</td>`}
      <td>${sourceLink(reference.sourceUrl, reference.sourceTitle)}<br><span class="reference-meta">${escapeHtml(dates)}</span>${!compact && reference.notes ? `<br><span class="reference-meta">${escapeHtml(reference.notes)}</span>` : ''}</td></tr>`;
  }).join('');
  return `<div class="data-table-wrap" role="region" aria-label="Tabela com rolagem horizontal" tabindex="0"><table class="data-table"><caption>Preços de energia publicados para os escopos indicados. Valores de redes e de conectores individuais não se aplicam automaticamente a outros pontos.</caption>
    <thead><tr><th scope="col">Rede ou local e escopo</th><th scope="col">Tipo</th><th scope="col">Energia</th>${compact ? '' : '<th scope="col">Taxa fixa conhecida</th>'}<th scope="col">Fonte e datas</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function vehicleSources(vehicle) {
  const links = [];
  const seen = new Set();
  function addSource(value, label) {
    let url;
    try { url = new URL(value); } catch { return; }
    if (url.protocol !== 'https:' || url.username || url.password || seen.has(url.href)) return;
    seen.add(url.href);
    links.push(sourceLink(url.href, label));
  }
  addSource(vehicle.sourceUrl, vehicle.sourceTitle || 'Ficha da fabricante');
  addSource(vehicle.rangeSourceUrl, 'Referência de autonomia PBEV');
  addSource(vehicle.modelYearSourceUrl, 'Referência do ano/modelo');
  for (const source of Array.isArray(vehicle.sourceUrls) ? vehicle.sourceUrls : []) {
    addSource(typeof source === 'string' ? source : source?.url ?? source?.sourceUrl,
      typeof source === 'string' ? 'Fonte adicional de especificações' : source?.title ?? source?.sourceTitle ?? 'Fonte adicional de especificações');
  }
  if (!links.length) links.push('Fonte não informada');
  return `${links.join('<br>')}<br><span class="reference-meta">Conferência: ${date(vehicle.checkedAt)}</span>`;
}

function vehicleTable(catalog) {
  const rows = catalog.map(vehicle => `<tr><th scope="row">${escapeHtml(vehicle.name)}<br><span class="reference-meta">Ano/modelo: ${escapeHtml(vehicle.modelYear || 'não especificado')}</span></th>
    <td>${numeric(vehicle.capacity)} kWh<br><span class="reference-meta">${escapeHtml(capacityBasis(vehicle.capacityBasis))}</span></td>
    <td>${numeric(vehicle.rangeKm)} km</td><td>${numeric(vehicle.dcKw)} kW</td><td>${numeric(vehicle.acKw)} kW</td>
    <td>${escapeHtml(Array.isArray(vehicle.connector) ? vehicle.connector.join(' / ') : vehicle.connector || 'Consultar a versão')}</td><td>${vehicleSources(vehicle)}</td></tr>`).join('');
  return `<div class="data-table-wrap" role="region" aria-label="Tabela com rolagem horizontal" tabindex="0"><table class="data-table"><caption>Versões disponíveis no planejador. Autonomia de referência PBEV/Inmetro; limites de recarga são valores nominais ou máximos publicados, não a potência média de uma sessão.</caption>
    <thead><tr><th scope="col">Modelo e versão</th><th scope="col">Bateria e base</th><th scope="col">Autonomia PBEV</th><th scope="col">DC máximo</th><th scope="col">AC máximo</th><th scope="col">Conectores</th><th scope="col">Fontes</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

const gtmHead = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TR9GTJ45');</script>
<!-- End Google Tag Manager -->`;
const gtmBody = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TR9GTJ45" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

function documentPage({ slug, title, heading, description, intro, body }) {
  const canonical = `${origin}/${slug}/`;
  const structuredData = {
    '@context': 'https://schema.org', '@graph': [
      {
        '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical,
        name: title, description, inLanguage: 'pt-BR', dateModified: modifiedAt,
        isPartOf: { '@id': `${origin}/#website` }, breadcrumb: { '@id': `${canonical}#breadcrumb` }
      },
      {
        '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Eletricities', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: heading, item: canonical }
        ]
      }
    ]
  };
  const navLinks = [['precos-recarga', 'Preços'], ['carros-eletricos', 'Carros'], ['sobre-os-dados', 'Fontes e cálculos']]
    .map(([href, label]) => `<a href="/${href}/"${href === slug ? ' aria-current="page"' : ''}>${label}</a>`).join('\n');
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
${gtmHead}
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f7f8f2">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Eletricities"><meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${origin}/assets/social-preview.png"><meta property="og:image:width" content="1280"><meta property="og:image:height" content="672"><meta property="og:image:alt" content="Planejador Eletricities para rotas e pontos de recarga">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${origin}/assets/social-preview.png">
<link rel="icon" href="/assets/bolt.svg" type="image/svg+xml"><link rel="stylesheet" href="${stylesheet}">
${scriptData(structuredData)}
</head><body>
${gtmBody}
<a class="skip-link" href="#conteudo">Ir para o conteúdo</a>
<header class="site-header frame"><a href="/" class="brand" aria-label="Eletricities, início">eletricities<span class="brand-period">.</span></a><nav aria-label="Navegação principal"><a href="/#planejador">Planejador</a>${navLinks}</nav><a href="/#planejador" class="button button-dark header-cta">Planejar rota</a></header>
<main id="conteudo" class="document-main content-frame">
<nav class="breadcrumb" aria-label="Caminho da página"><a href="/">Eletricities</a> <span aria-hidden="true">/</span> <span aria-current="page">${escapeHtml(heading)}</span></nav>
<header class="document-header"><p class="eyebrow">GUIA ELETRICITIES</p><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p><p class="reference-meta">Conteúdo atualizado em <time datetime="${modifiedAt}">${date(modifiedAt)}</time>. A data de conferência de cada fonte aparece nas tabelas.</p></header>
${body}
</main>
<footer class="site-footer content-frame"><a href="/" class="brand">eletricities<span class="brand-period">.</span></a><span>Planejamento para viagens elétricas no Brasil.</span><a href="/#planejador">Voltar ao planejador →</a></footer>
</body></html>\n`;
}

function pricePage(references, catalog) {
  const example = catalog.find(vehicle => Number.isFinite(vehicle.capacity) && vehicle.capacity > 0);
  const dc = meanReferences(references, 'DC');
  const energy = example ? example.capacity * 0.6 : null;
  const exampleText = example && dc ? `<div class="callout"><h3>Exemplo de orçamento, sem tarifa confirmada</h3><p>Em um ${escapeHtml(example.name)}, ano/modelo ${escapeHtml(example.modelYear || 'da ficha citada')}, uma carga de 20% a 80% corresponde a aproximadamente <strong>${numeric(energy)} kWh</strong>, usando a ${escapeHtml(capacityBasis(example.capacityBasis))} de ${numeric(example.capacity)} kWh. Pela média de referência DC de ${escapeHtml(money(dc.mean))}/kWh, a parcela estimada de energia seria <strong>${escapeHtml(money(energy * dc.mean))}</strong>.</p><p>Esse exemplo não identifica o preço de um eletroposto. Não inclui taxas, perdas, estacionamento ou ociosidade. Veja a ficha e a base da bateria no <a href="/carros-eletricos/">catálogo de veículos</a>.</p></div>` : '';
  return documentPage({
    slug: 'precos-recarga', title: 'Preço para carregar carro elétrico: tarifas e estimativas | Eletricities',
    heading: 'Quanto custa recarregar um carro elétrico?',
    description: 'Compare tarifas publicadas de recarga AC e DC, com fontes, datas, taxas e limites. Entenda a média de referência usada quando o preço local não está confirmado.',
    intro: 'O valor depende do ponto, do tipo de recarga e das condições da operadora. Aqui você compara referências publicadas e entende o que entra na estimativa da sua viagem.',
    body: `<nav class="document-toc" aria-label="Nesta página"><a href="#tarifas">Tarifas com fonte</a><a href="#medias">Médias de referência</a><a href="#orcamento">Como orçar a recarga</a><a href="#duvidas">Dúvidas de preço</a></nav>
<section class="document-section" id="tarifas"><h2>Tarifas publicadas, com local e condição identificados</h2><p>AC é corrente alternada; DC é corrente contínua. Uma tabela de rede e o preço de um conector específico têm escopos diferentes. Consulte a fonte para verificar se a regra se aplica à sua parada.</p>${tariffTable(references)}<p class="data-note">Uma referência conferida não significa preço monitorado em tempo real. Taxa não detalhada também não significa taxa zero. Tarifas promocionais, planos de assinatura e condições locais podem alterar a cobrança.</p></section>
<section class="document-section" id="medias"><h2>Quando falta o preço: média estimada, com amostra aberta</h2>${benchmarkTable(references)}<p>A média aritmética usa uma observação por tabela de rede e tipo AC/DC ou por ponto e conector indicados na fonte. Cada referência tem o mesmo peso; não repetimos uma tabela de rede pelo número de seus carregadores. Taxas por sessão e minuto ficam fora da média de energia. A faixa é o menor e o maior preço da amostra, não uma garantia para outros pontos.</p><p>No planejador, a preferência é pelo preço publicado para a estação. Na ausência dele, a estimativa procura pelo menos três estações da mesma operadora e tipo; se não houver amostra suficiente, procura cinco da mesma região e tipo. O conjunto de referências desta página é a alternativa quando essas amostras também são insuficientes. O cartão informa a origem, o tamanho e a faixa da amostra.</p><p>Somente registros com fonte, data válida e preço de energia compatível entram nas amostras. Valores estimados não alimentam outras médias. Cobrança exclusivamente por tempo ou sessão e condições monetárias ambíguas permanecem para consulta, sem conversão automática para R$/kWh.</p></section>
<section class="document-section" id="orcamento"><h2>Energia e taxa de sessão são parcelas diferentes</h2><p><strong>Subtotal = energia prevista em kWh × tarifa por kWh + taxa fixa conhecida.</strong> Ociosidade, estacionamento e perdas de recarga não são somados sem dados próprios. Quando a energia usa uma média, o subtotal continua sendo uma estimativa.</p>${exampleText}<p><a class="button button-dark" href="/#planejador">Estimar minha viagem</a></p></section>
<section class="document-section faq-section" id="duvidas"><h2>Dúvidas sobre preço de recarga</h2><details><summary>O valor por kWh já inclui tudo?</summary><p>Não necessariamente. Algumas redes cobram conectividade por sessão, permanência após o fim da recarga ou estacionamento. A tabela separa a taxa fixa publicada e mantém as demais condições na descrição da fonte.</p></details><details><summary>Uma média pode ser usada como tarifa da estação?</summary><p>Ela serve para estimar o orçamento quando falta um preço aplicável ao ponto. A interface identifica o valor como estimado; confirme a cobrança na operadora antes de iniciar a sessão.</p></details><details><summary>Recarga AC é sempre mais barata?</summary><p>As referências desta página permitem comparar apenas os escopos listados. Elas não demonstram que todo ponto AC custa menos que todo ponto DC. A potência disponível, a tarifa local e o tempo de permanência precisam ser avaliados juntos.</p></details></section>`
  });
}

function carsPage(catalog) {
  return documentPage({
    slug: 'carros-eletricos', title: 'Carros elétricos: autonomia, bateria e recarga por versão | Eletricities',
    heading: 'Bateria, autonomia e recarga por versão do carro',
    description: 'Consulte modelos e anos do catálogo Eletricities, com autonomia PBEV/Inmetro, capacidade da bateria, limites AC/DC e links para as fichas oficiais.',
    intro: 'O mesmo nome de carro pode ter baterias e limites de carga diferentes. Escolha a versão e o ano da ficha para que a estimativa use os dados correspondentes.',
    body: `<nav class="document-toc" aria-label="Nesta página"><a href="#catalogo">Catálogo e fontes</a><a href="#bateria">Capacidade útil e nominal</a><a href="#potencia">Potência e tempo</a></nav>
<section class="document-section" id="catalogo"><h2>${catalog.length} versões com referências identificadas</h2>${vehicleTable(catalog)}<p class="data-note">Os números são referências de catálogo. Alterações de ano, versão, software e condição da bateria podem mudar o comportamento do seu veículo. A potência máxima publicada não é uma promessa de potência constante.</p></section>
<section class="document-section" id="bateria"><h2>Capacidade nominal e capacidade útil não são a mesma medida</h2><p>A capacidade nominal ou bruta descreve a energia total publicada para o conjunto. A capacidade útil descreve a parcela disponibilizada para uso. A tabela identifica a base usada quando a fabricante a informa; se ela não estiver especificada, o valor permanece como capacidade publicada.</p><p>O planejador não inventa uma reserva técnica para converter capacidade nominal em útil. Por isso, a energia calculada a partir de uma capacidade nominal é uma aproximação de catálogo. A energia medida e cobrada no carregador pode ser maior devido às perdas.</p></section>
<section class="document-section" id="potencia"><h2>O carro também limita a velocidade de recarga</h2><p>Em AC, o carregador embarcado do veículo limita o aproveitamento da potência do ponto. Em DC, a potência máxima e a curva de recarga do carro também limitam a sessão. O cálculo usa o menor limite publicado entre veículo e conector.</p><p>O tempo exibido é um mínimo teórico: energia dividida pela potência nominal compatível. Estado de carga, temperatura, compartilhamento da estação, redução de potência e perdas podem aumentar a duração real. O consumo em rodovia também pode diferir da autonomia de laboratório PBEV/Inmetro.</p><p><a href="/sobre-os-dados/">Consultar as fórmulas e os limites do planejamento →</a></p><p><a class="button button-dark" href="/#planejador">Escolher meu carro e planejar</a></p></section>`
  });
}

function methodsPage() {
  return documentPage({
    slug: 'sobre-os-dados', title: 'Fontes de estações, tarifas e cálculos de recarga | Eletricities',
    heading: 'De onde vêm os dados e como calculamos',
    description: 'Conheça as fontes de estações, rotas, veículos e tarifas do Eletricities, as fórmulas de energia e tempo e os limites das estimativas de viagem.',
    intro: 'Um ponto no mapa, um preço publicado e uma estimativa são informações distintas. As fontes e as hipóteses abaixo ajudam a interpretar cada resultado antes de escolher a parada.',
    body: `<nav class="document-toc" aria-label="Nesta página"><a href="#fontes">Estações e rotas</a><a href="#precos">Preços e estimativas</a><a href="#calculos">Fórmulas</a><a href="#limites">Limites práticos</a></nav>
<section class="document-section" id="fontes"><h2>Estações e rotas</h2><p>Os cadastros vêm do Open Charge Map e do OpenStreetMap. A consulta ao Open Charge Map passa pelo backend do Eletricities; o catálogo complementar contém registros públicos exportados em abril de 2026. A interface diferencia consultas à API de registros dessa base histórica.</p><p>As rotas rodoviárias são calculadas com OSRM, a partir dos dados do OpenStreetMap, usando o serviço FOSSGIS e o servidor do projeto como alternativa. O mapa-base também vem do OpenStreetMap. Uma estação próxima da linha da rota pode exigir um desvio, ter acesso restrito ou estar do outro lado de uma rodovia.</p><p>O cadastro de um ponto não comprova funcionamento naquele momento. Data de atualização do cadastro, data de verificação e data de conferência de preço têm significados diferentes e aparecem separadamente quando disponíveis.</p><ul><li>${sourceLink('https://www.openchargemap.org/about/terms', 'Open Charge Map: termos e atribuição dos dados')}</li><li>${sourceLink('https://www.openstreetmap.org/copyright', 'OpenStreetMap: colaboradores e atribuição')}</li><li>${sourceLink('https://project-osrm.org/', 'OSRM: projeto de cálculo de rotas')}</li></ul></section>
<section class="document-section" id="precos"><h2>Preço publicado e valor estimado</h2><p>A aplicação preserva o texto original das condições de cobrança. Um preço de energia só é extraído quando a moeda, a unidade e a regra são compatíveis; AC e DC são separados. Taxas fixas explícitas podem entrar no subtotal. Regras por horário, assinatura ou outras condições ambíguas continuam disponíveis para leitura.</p><p>Referências conferidas nas operadoras têm URL, data e escopo. Elas se aplicam ao ponto, conector ou tabela indicado, sem atribuição automática por semelhança de nome. Essas conferências são referências registradas com data; não são uma consulta contínua aos portais.</p><p>Quando falta tarifa por energia aplicável, uma média pode ajudar no orçamento. A ordem é mesma operadora e tipo com pelo menos três estações; depois mesma região e tipo com pelo menos cinco; por fim, o conjunto de referências publicadas por AC/DC. Duplicatas são removidas, preços estimados não realimentam a amostra e registros com condições incompatíveis ficam de fora. As amostras de estações usam referências datadas de até 365 dias no momento do cálculo.</p><p>O cartão apresenta o tamanho da amostra, sua faixa observada e as fontes. Média estimada não confirma a tarifa local nem representa uma média nacional. Taxa ausente não é tratada como publicação de taxa zero.</p><p><a href="/precos-recarga/">Ver as referências, datas e médias de energia →</a></p></section>
<section class="document-section" id="calculos"><h2>As hipóteses do planejamento</h2><h3>Autonomia e paradas</h3><p>O planejamento usa a autonomia PBEV/Inmetro da versão escolhida, a carga informada na partida, uma reserva de <strong>10%</strong> e uma carga-alvo de até <strong>80%</strong> nas paradas. A referência de laboratório não modela separadamente velocidade, relevo, vento, temperatura, carga transportada e ar-condicionado.</p><h3>Energia prevista</h3><p><strong>Energia (kWh) = capacidade da bateria (kWh) × (carga final − carga inicial) ÷ 100.</strong> Os percentuais se referem à sessão planejada. A tabela de veículos informa se a capacidade publicada é útil, nominal/bruta ou não especificada. Não há conversão arbitrária entre essas bases.</p><h3>Tempo mínimo teórico</h3><p><strong>Tempo (min) = energia prevista (kWh) ÷ menor potência compatível entre carro e conector (kW) × 60.</strong> O resultado é um limite teórico com potência constante, não uma previsão da curva de recarga. Fila, preparação, perdas e redução de potência não são incluídas.</p><h3>Subtotal da recarga</h3><p><strong>Subtotal = energia prevista × tarifa de energia + taxa fixa conhecida por sessão.</strong> Quando a tarifa vem de média, o resultado permanece estimado. Estacionamento, ociosidade e perdas não entram no subtotal sem informação própria; a regra de ociosidade publicada é exibida para consulta.</p><p><a href="/carros-eletricos/">Conferir bateria, autonomia e limites de cada versão →</a></p></section>
<section class="document-section" id="limites"><h2>O que conferir antes de iniciar a recarga</h2><ul><li>Tarifa e taxas atuais no aplicativo ou canal da operadora.</li><li>Conector, potência, horário e regras de acesso do local.</li><li>Disponibilidade, manutenção e eventual necessidade de cadastro.</li><li>Carga real do carro e margem suficiente para chegar à alternativa.</li></ul><p>Uma rota calculada não garante uma sequência disponível de recargas. Quando os dados não permitem sugerir paradas com a reserva adotada, o planejador informa essa limitação. Não exibimos ocupação em tempo real como se tivesse sido confirmada.</p><p><a class="button button-dark" href="/#planejador">Abrir o planejador</a></p></section>`
  });
}

function replaceBlock(html, marker, content) {
  const start = `<!-- ${marker} -->`;
  const end = `<!-- /${marker} -->`;
  const first = html.indexOf(start);
  const last = html.indexOf(end, first + start.length);
  if (first < 0 || last < 0 || html.indexOf(start, first + start.length) >= 0 || html.indexOf(end, last + end.length) >= 0) {
    throw new Error(`Marcador de conteúdo ausente ou repetido: ${marker}`);
  }
  return html.slice(0, first + start.length) + `\n${content}\n` + html.slice(last);
}

export async function buildContent() {
  const catalog = (Array.isArray(vehicles) ? vehicles : Object.values(vehicles))
    .filter(vehicle => vehicle && typeof vehicle.name === 'string');
  const references = tariffReferences.filter(reference => reference &&
    ['AC', 'DC'].includes(reference.current) && Number.isFinite(reference.pricePerKwh) && reference.pricePerKwh >= 0);
  if (!catalog.length || !references.length) throw new Error('Catálogos públicos necessários para gerar o conteúdo.');
  const homeFile = path.join(root, 'dist/index.html');
  let home = await readFile(homeFile, 'utf8');
  home = replaceBlock(home, 'STRUCTURED_DATA', scriptData({
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`, name: 'Eletricities', inLanguage: 'pt-BR' },
      {
        '@type': 'WebApplication', '@id': `${origin}/#app`, name: 'Eletricities', url: `${origin}/`,
        description: 'Planejador gratuito de rotas de carro elétrico no Brasil, com estações de recarga, preços publicados e estimativas identificadas de custo e tempo.',
        applicationCategory: 'TravelApplication', operatingSystem: 'Navegador web',
        browserRequirements: 'Requer JavaScript e acesso à internet', inLanguage: 'pt-BR',
        isAccessibleForFree: true, offers: { '@type': 'Offer', price: 0, priceCurrency: 'BRL' }
      }
    ]
  }));
  home = replaceBlock(home, 'HOME_TARIFF_SUMMARY', tariffTable(references.slice(0, 4), true));
  const pages = [
    ['precos-recarga', pricePage(references, catalog)],
    ['carros-eletricos', carsPage(catalog)],
    ['sobre-os-dados', methodsPage()]
  ];
  for (const [slug, html] of pages) {
    const directory = path.join(root, 'dist', slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'index.html'), html.replace(/[\t ]+$/gm, ''));
  }
  await writeFile(homeFile, home.replace(/[\t ]+$/gm, ''));
  await writeFile(path.join(root, 'dist/robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`);
  const locations = ['/', ...pages.map(([slug]) => `/${slug}/`)];
  await writeFile(path.join(root, 'dist/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations.map(location => `  <url><loc>${origin}${location}</loc><lastmod>${modifiedAt}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  return { pages: pages.length, vehicles: catalog.length, tariffReferences: references.length, modifiedAt };
}
