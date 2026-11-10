// These are published ENERGY rates, not a survey of Brazil or prices confirmed
// at a station receiving an estimate. One observation per table/type or named
// station prevents a network with many connectors from dominating the fallback.
const checkedAt = '2026-11-09';
const volvoUrl = 'https://www.volvocars.com/br/media/press-releases/BC28C2E96CE1476C/';
const celescUrl = 'https://celesc.com.br/listagem-noticias/celesc-trabalha-na-ampliacao-da-rede-de-eletropostos-na-grande-florianopolis';

export const tariffReferences = Object.freeze([
  {
    id: 'volvo-dc-2026', operator: 'Volvo Car Eletropostos', current: 'DC',
    pricePerKwh: 2.90, activationFee: 2.50,
    scope: 'Tabela da rede Volvo: carregadores rápidos DC',
    sourceUrl: volvoUrl, sourceTitle: 'Volvo Car Brasil · tabela publicada',
    publishedAt: '2026-06-02', effectiveFrom: '2026-06-15', checkedAt,
    notes: 'R$ 2,50 de conectividade por sessão. Ociosidade de R$ 5/min nos rápidos em rodovias, após 15 min de tolerância. Taxas não entram na média de energia.'
  },
  {
    id: 'volvo-ac-2026', operator: 'Volvo Car Eletropostos', current: 'AC',
    pricePerKwh: 2.00, activationFee: 2.50,
    scope: 'Tabela da rede Volvo: carregadores de conveniência AC',
    sourceUrl: volvoUrl, sourceTitle: 'Volvo Car Brasil · tabela publicada',
    corroboratingUrl: 'https://www.volvocars.com/br/media/press-releases/B00A3215225CCCB8/',
    publishedAt: '2026-06-02', effectiveFrom: '2026-06-15', checkedAt,
    notes: 'A aplicação a AC de conveniência é reiterada em 23/07/2026 para o Catarina Fashion Outlet. Não identifica todos os pontos urbanos da marca.'
  },
  {
    id: 'celesc-dc-2026', operator: 'Celesc', current: 'DC',
    pricePerKwh: 2.29, activationFee: null,
    scope: 'Rede pública Celesc em Santa Catarina: estações rápidas',
    sourceUrl: celescUrl, sourceTitle: 'Celesc · publicação de junho de 2026',
    publishedAt: '2026-06-09', effectiveFrom: null, checkedAt,
    notes: 'A publicação de junho reitera a tarifa e identifica arranjos rápidos de 60 kW CC. Taxas adicionais não são detalhadas nessa publicação.'
  },
  {
    id: 'celesc-ac-2026', operator: 'Celesc', current: 'AC',
    pricePerKwh: 1.99, activationFee: null,
    scope: 'Rede pública Celesc em Santa Catarina: estações semirrápidas AC',
    sourceUrl: celescUrl, sourceTitle: 'Celesc · publicação de junho de 2026',
    publishedAt: '2026-06-09', effectiveFrom: null, checkedAt,
    notes: 'A publicação identifica estações semirrápidas de 22 kW CA e 7,3 kW CA. Taxas adicionais não são detalhadas nessa publicação.'
  },
  {
    id: 'kinsol-mourisco-dc-2', operator: 'Kinsol', current: 'DC',
    pricePerKwh: 1.64, activationFee: null,
    scope: 'Kinsol Mourisco, São Paulo: conector esquerdo ID 2, CCS2, 60 kW',
    stationId: 'ocm-312959',
    sourceUrl: 'https://app.evoltbr.com/#/charger/KINSOL-109/2',
    sourceTitle: 'EVoltBR · portal público do carregador',
    publishedAt: null, effectiveFrom: null, checkedAt: '2026-11-06',
    notes: 'Valor observado no portal em 06/11/2026; não é uma tabela de toda a rede. Taxas adicionais não confirmadas.'
  },
  {
    id: 'kinsol-puglia-dc-2', operator: 'Kinsol', current: 'DC',
    pricePerKwh: 1.99, activationFee: null,
    scope: 'Kinsol Puglia, Guarulhos: conector esquerdo ID 2, CCS2, 60 kW',
    stationId: 'ocm-312960',
    sourceUrl: 'https://app.evoltbr.com/#/charger/KINSOL-107/2',
    sourceTitle: 'EVoltBR · portal público do carregador',
    publishedAt: null, effectiveFrom: null, checkedAt: '2026-11-06',
    notes: 'Valor observado no portal em 06/11/2026; não é uma tabela de toda a rede. Taxas adicionais não confirmadas.'
  }
].map(reference => Object.freeze(reference)));

const normalize = value => String(value ?? '').normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
const isCurrent = value => value === 'AC' || value === 'DC';
const validUrl = value => typeof value === 'string' && /^https?:\/\//i.test(value);
const money = value => `R$ ${value.toFixed(2).replace('.', ',')}`;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const day = 86400000;
const maximumSampleAge = 365 * day;
const minimumOperatorSamples = 3;
const minimumRegionalSamples = 5;

// Only explicit operator metadata is used; a Volvo word in a place's name or
// an EZVolt data-provider name does not prove its operator or tariff network.
function operatorOf(station) {
  const name = normalize(station.operatorName ?? station.operator ?? station.networkName);
  if (!name || /unknown|desconhecid|not known|^other$|^outros?$|^n\/a$/.test(name)) return null;
  return name;
}

const stateGroups = [
  ['Norte', 'AC:acre|AP:amapa|AM:amazonas|PA:para|RO:rondonia|RR:roraima|TO:tocantins'],
  ['Nordeste', 'AL:alagoas|BA:bahia|CE:ceara|MA:maranhao|PB:paraiba|PE:pernambuco|PI:piaui|RN:rio grande do norte|SE:sergipe'],
  ['Centro-Oeste', 'DF:distrito federal|GO:goias|MT:mato grosso|MS:mato grosso do sul'],
  ['Sudeste', 'ES:espirito santo|MG:minas gerais|RJ:rio de janeiro|SP:sao paulo'],
  ['Sul', 'PR:parana|RS:rio grande do sul|SC:santa catarina']
];
const stateRegions = new Map(stateGroups.flatMap(([region, states]) => states.split('|')
  .flatMap(state => state.split(':').map(name => [normalize(name), region]))));

function regionOf(station) {
  const candidates = [station.state, station.stateOrProvince, station.region,
    ...String(station.address ?? '').split('·').slice(-1)];
  for (const candidate of candidates) {
    const region = stateRegions.get(normalize(candidate));
    if (region) return region;
  }
  return null;
}

function rawTariff(station) {
  if (typeof station.rawTariff === 'string') return station.rawTariff;
  return (station.tariffDetails ?? []).filter(term =>
    /tarifa publicada para o local|custo publicado|usagecost|^cobranca (?:cadastrada|de recarga|por horario ou condicao|informada|pela recarga)$|^condicoes (?:da recarga|de cobranca|da cobranca de recarga)$|^(?:charge|fee)(?::|$)/.test(normalize(term.label)))
    .map(term => term.value ?? '').join(' ');
}

// Unknown prose such as "consulte o app" does not prevent an estimate. A known
// session/time tariff, conditional rate, or monetary text with no energy unit
// does: averaging R$/session or a membership discount into R$/kWh is invalid.
function incompatibleTariff(station) {
  if (station.isConditionalPrice || station.priceConditional || station.tariffModel === 'session' || station.tariffModel === 'time') return true;
  const text = normalize(rawTariff(station));
  const monetary = /r\$|\bbrl\b/.test(text) && /\d/.test(text);
  const energyUnit = /(?:\/|por|per)\s*kwh\b/.test(text);
  if (!Number.isFinite(station.pricePerKwh) && station.canEstimateCost === true && Number.isFinite(station.activationFee)) return true;
  if (/(?:\/|por|per)\s*(?:min(?:uto)?s?|h(?:ora)?s?|sessao|session|recarga)\b/.test(text) && !energyUnit) return true;
  if (monetary && !energyUnit) return true;
  if (/(?:desconto|promoc|somente|apenas|exceto|assinant|hosped|motoristas? de aplicativo|clientes? (?:volvo|gwm)|membership)/.test(text) && (monetary || /gratuit|gratis|free|%/.test(text))) return true;
  // An unparsed monetary energy tariff can contain incompatible bands or
  // conditions. Keep the original publication visible rather than replacing it.
  if (!Number.isFinite(station.pricePerKwh) && monetary && energyUnit) return true;
  return false;
}

function sampleDate(station) {
  return station.priceSourceCheckedAt ?? station.sourceUpdatedAt ?? station.lastVerifiedAt ?? null;
}

function sampleFrom(station, evaluatedAt) {
  if (!station || station.isEstimatedPrice || station.priceEstimate || !isCurrent(station.current)) return null;
  if (!Number.isFinite(station.pricePerKwh) || station.pricePerKwh <= 0 || station.canEstimateCost !== true || incompatibleTariff(station)) return null;
  const date = sampleDate(station);
  const age = evaluatedAt - Date.parse(date);
  if (!Number.isFinite(age) || age < -day || age > maximumSampleAge) return null;
  const sourceUrl = [station.priceSourceUrl, station.ocmUrl].find(validUrl);
  if (!sourceUrl) return null;
  return { station, price: station.pricePerKwh, current: station.current,
    operator: operatorOf(station), region: regionOf(station), sourceUrl, date };
}

function stationKey(station) {
  const base = String(station.locationId ?? station.id ?? '').match(/^ocm-\d+/)?.[0]
    ?? String(station.locationId ?? station.id ?? '');
  // Both IDs are the same independently address-verified Batistella location.
  return base === 'ocm-481257' ? 'ocm-300112' : base;
}

function uniqueSamples(stations, evaluatedAt) {
  const selected = [];
  const conflicted = new Set();
  for (const station of stations) {
    const sample = sampleFrom(station, evaluatedAt);
    if (!sample) continue;
    const address = normalize(station.address);
    const existing = selected.find(item => item.current === sample.current &&
      (stationKey(item.station) === stationKey(station) ||
        (address && address !== 'localizacao no mapa' && normalize(item.station.address) === address)));
    if (!existing) { selected.push(sample); continue; }
    // A point with conflicting same-date connector prices is not counted twice
    // or reduced to an average of its own. Omit that ambiguous observation.
    const existingDate = Date.parse(existing.date);
    const incomingDate = Date.parse(sample.date);
    if (incomingDate > existingDate) {
      Object.assign(existing, sample);
      conflicted.delete(existing);
    }
    else if (incomingDate === existingDate && existing.price !== sample.price) conflicted.add(existing);
  }
  return selected.filter(sample => !conflicted.has(sample));
}

function referenceSamples(current) {
  return tariffReferences.filter(reference => reference.current === current).map(reference => ({
    price: reference.pricePerKwh, current, sourceUrl: reference.sourceUrl,
    date: reference.checkedAt, referenceId: reference.id
  }));
}

export function applyTariffEstimates(stations, { now = Date.now } = {}) {
  if (!Array.isArray(stations)) return [];
  const evaluatedAt = now();
  const calculatedAt = new Date(evaluatedAt).toISOString();
  const samples = uniqueSamples(stations, evaluatedAt);
  return stations.map(station => {
    if (!station || Number.isFinite(station.pricePerKwh) ||
      (station.pricePerKwh != null && !Number.isNaN(station.pricePerKwh)) ||
      !isCurrent(station.current) || station.isEstimatedPrice || incompatibleTariff(station)) return station;
    const current = station.current;
    const operator = operatorOf(station);
    const region = regionOf(station);
    let matching = operator ? samples.filter(sample => sample.current === current && sample.operator === operator) : [];
    let method = 'operator-current';
    let description = `Média de estações da mesma operadora · ${current}`;
    if (matching.length < minimumOperatorSamples) {
      matching = region ? samples.filter(sample => sample.current === current && sample.region === region) : [];
      method = 'region-current';
      description = `Média de estações ${current} · ${region}`;
      if (matching.length < minimumRegionalSamples) {
        matching = referenceSamples(current);
        method = 'reference-current';
        description = `Média de referências ${current}`;
      }
    }
    if (!matching.length) return station;
    const values = matching.map(sample => sample.price);
    const mean = round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const sourceUrls = [...new Set(matching.map(sample => sample.sourceUrl))];
    const dates = matching.map(sample => sample.date).sort();
    const sampleUnit = method === 'reference-current' ? 'referências publicadas' : 'estações com preço cadastrado';
    const priceEstimate = {
      method, description, sampleSize: matching.length, sampleUnit, current, checkedAt, calculatedAt,
      min: Math.min(...values), max: Math.max(...values), sourceUrls,
      sampleOldestAt: dates[0], sampleNewestAt: dates.at(-1),
      referenceIds: matching.map(sample => sample.referenceId).filter(Boolean),
      includesFees: false,
      limitation: 'Estimativa de energia; não confirma a tarifa deste ponto nem representa uma média nacional. Taxas de ativação, estacionamento e ociosidade não foram estimadas.'
    };
    return {
      ...station,
      pricePerKwh: mean,
      isEstimatedPrice: true,
      priceEstimate,
      canEstimateCost: true,
      priceSourceTitle: `Estimativa · ${description}`,
      priceSourceUrl: sourceUrls[0],
      pricePublishedAt: null,
      priceEffectiveFrom: null,
      priceSourceCheckedAt: null,
      priceScope: 'Valor estimado de energia, sujeito à tarifa e às taxas do operador',
      tariffDetails: [...(station.tariffDetails ?? []), {
        label: description,
        value: `${matching.length} ${sampleUnit}; intervalo observado de ${money(priceEstimate.min)} a ${money(priceEstimate.max)}/kWh. Tarifa deste ponto não confirmada.`
      }]
    };
  });
}
