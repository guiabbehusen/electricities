(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const form = byId('planner-form');
  if (!form) return;

  const originInput = byId('origin');
  const destinationInput = byId('destination');
  const vehicleInput = byId('vehicle');
  const batteryInput = byId('battery');
  const routeOptions = byId('route-options');
  const stationList = byId('station-list');
  const status = byId('planner-status');
  const routeMap = byId('route-map');
  const submit = form.querySelector('[type="submit"]');

  // Published battery capacity, PBEV/Inmetro range, and vehicle charging limits.
  const vehicles = {
    dolphin: { name: 'BYD Dolphin', capacity: 44.9, rangeKm: 291, dcKw: 60, acKw: 6.6 },
    'dolphin-mini': { name: 'BYD Dolphin Mini', capacity: 38, rangeKm: 280, dcKw: 40, acKw: 6.6 },
    ex30: { name: 'Volvo EX30 Single Motor 2025', capacity: 49, rangeKm: 250, dcKw: 134, acKw: 11 },
    'ex30-er': { name: 'Volvo EX30 Extended Range 2025', capacity: 65, rangeKm: 338, dcKw: 153, acKw: 11 }
  };

  const cities = [
    { name: 'São Paulo, SP', latitude: -23.5505, longitude: -46.6333 },
    { name: 'Rio de Janeiro, RJ', latitude: -22.9068, longitude: -43.1729 },
    { name: 'Campinas, SP', latitude: -22.9056, longitude: -47.0608 },
    { name: 'São José dos Campos, SP', latitude: -23.1896, longitude: -45.8841 },
    { name: 'Santos, SP', latitude: -23.9608, longitude: -46.3339 },
    { name: 'Ribeirão Preto, SP', latitude: -21.1775, longitude: -47.8103 },
    { name: 'Belo Horizonte, MG', latitude: -19.9167, longitude: -43.9345 },
    { name: 'Curitiba, PR', latitude: -25.4284, longitude: -49.2733 },
    { name: 'Florianópolis, SC', latitude: -27.5954, longitude: -48.5480 },
    { name: 'Porto Alegre, RS', latitude: -30.0346, longitude: -51.2177 },
    { name: 'Brasília, DF', latitude: -15.7939, longitude: -47.8828 },
    { name: 'Goiânia, GO', latitude: -16.6869, longitude: -49.2648 },
    { name: 'Vitória, ES', latitude: -20.3155, longitude: -40.3128 },
    { name: 'Salvador, BA', latitude: -12.9714, longitude: -38.5014 },
    { name: 'Recife, PE', latitude: -8.0476, longitude: -34.8770 },
    { name: 'Fortaleza, CE', latitude: -3.7319, longitude: -38.5267 }
  ];

  const state = {
    origin: null,
    destination: null,
    routes: [],
    stationSource: [],
    stations: [],
    selectedRoute: null,
    activeStation: null,
    stationsPending: false,
    stationsUnavailable: false,
    pending: null,
    stationCache: new Map(),
    routeCache: new Map(),
    places: new Map()
  };
  const stationSnapshot = window.EletricitiesStationSnapshot ?? [];

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const normalize = value => value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').toLowerCase();
  const distance = km => `${decimal.format(Math.round(km))} km`;
  const minutes = value => {
    const rounded = Math.ceil(value);
    const remainder = rounded % 60;
    return rounded >= 60 ? `${Math.floor(rounded / 60)} h${remainder ? ` ${remainder} min` : ''}` : `${rounded} min`;
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setText(id, value) {
    const node = byId(id);
    if (node) node.textContent = value;
  }

  function showStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function externalLink(label, url, className) {
    const link = element('a', className, label);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function appendSnapshotSource() {
    status.append(
      ' Pontos do catálogo de abril de 2026 são dos ',
      externalLink('colaboradores do Open Charge Map', 'https://github.com/openchargemap/ocm-export/tree/8e3bedca48ca94807d96b2f5e7ee02cffe63ae54/data/BR'),
      ' (dados filtrados, ',
      externalLink('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'),
      ', ',
      externalLink('termos de uso', 'https://www.openchargemap.org/about/terms'),
      ').'
    );
  }

  function icon() {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    const path = document.createElementNS(namespace, 'path');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '21');
    svg.setAttribute('height', '21');
    path.setAttribute('d', 'm13 2-9 12h7l-1 8 9-12h-7z');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.7');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    return svg;
  }

  function metric(label, value) {
    const node = element('span');
    node.append(element('small', null, label), element('strong', null, value));
    return node;
  }

  function nearbyStations(route, source, maximumDistance = 6) {
    // Project the line once per route, then find the nearest segment for each station.
    const pointScale = 111.2 * Math.cos(route.coordinates[0][0] * Math.PI / 180);
    const points = route.coordinates.map(([lat, lon]) => [lon * pointScale, lat * 111.2]);
    const [south, west, north, east] = route.coordinates.reduce(extendBounds, [Infinity, Infinity, -Infinity, -Infinity]);
    const latitudeBuffer = maximumDistance / 111.2;
    const longitudeBuffer = maximumDistance / pointScale;
    let geometryKm = 0;
    const segments = [];
    for (let index = 1; index < points.length; index += 1) {
      const [x, y] = points[index - 1];
      const dx = points[index][0] - x;
      const dy = points[index][1] - y;
      const length = Math.hypot(dx, dy);
      if (!length) continue;
      segments.push({ x, y, dx, dy, length, start: geometryKm });
      geometryKm += length;
    }
    return source.flatMap(station => {
      if (station.latitude < south - latitudeBuffer || station.latitude > north + latitudeBuffer ||
          station.longitude < west - longitudeBuffer || station.longitude > east + longitudeBuffer) return [];
      const x = station.longitude * pointScale;
      const y = station.latitude * 111.2;
      let detourKm = Infinity;
      let along = 0;
      for (const segment of segments) {
        const ratio = ((x - segment.x) * segment.dx + (y - segment.y) * segment.dy) / segment.length ** 2;
        const offset = Math.max(0, Math.min(1, ratio));
        const proximity = Math.hypot(x - segment.x - offset * segment.dx, y - segment.y - offset * segment.dy);
        if (proximity >= detourKm) continue;
        detourKm = proximity;
        along = segment.start + offset * segment.length;
      }
      if (detourKm > maximumDistance) return [];
      return [{ ...station, detourKm, distanceKm: along * route.distanceKm / geometryKm }];
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }

  function chargingEstimate(station, vehicle, from, to) {
    const energy = Math.max(0, (to - from) * vehicle.capacity);
    const vehicleLimit = station.current === 'DC' ? vehicle.dcKw : vehicle.acKw;
    const ratedPower = Math.min(vehicleLimit, station.powerKw ?? 0);
    return {
      estimatedMinutes: energy > 0 && ratedPower > 0 ? energy / ratedPower * 60 : null,
      estimatedCost: station.pricePerKwh === null ? null : energy * station.pricePerKwh
    };
  }

  function chargingPlan(route, stations, vehicle, startingCharge) {
    const reserve = 0.10;
    const target = 0.80;
    const start = { id: 'start', distanceKm: 0, detourKm: 0 };
    const end = { id: 'end', distanceKm: route.distanceKm, detourKm: 0 };
    const candidates = [start, ...stations.filter(station => station.current), end];
    const legConsumption = (from, to) =>
      (to.distanceKm - from.distanceKm + from.detourKm + to.detourKm) / vehicle.rangeKm;

    // Solve backwards so a reachable station is only proposed when it leads to the destination.
    const nextStops = new Map([[end.id, { count: 0, detour: 0 }]]);
    for (let index = candidates.length - 2; index >= 0; index -= 1) {
      const here = candidates[index];
      const available = (here === start ? startingCharge : target) - reserve;
      let best = null;
      for (let nextIndex = index + 1; nextIndex < candidates.length; nextIndex += 1) {
        const next = candidates[nextIndex];
        if ((next.distanceKm - here.distanceKm) / vehicle.rangeKm > available) break;
        const onward = nextStops.get(next.id);
        if (!onward || legConsumption(here, next) > available) continue;
        const count = onward.count + Number(next !== end);
        const detour = next.detourKm + onward.detour;
        if (!best || count < best.count || (count === best.count && detour < best.detour)) {
          best = { count, detour, next };
        }
      }
      if (best) nextStops.set(here.id, best);
    }

    if (!nextStops.has(start.id)) return null;
    const plan = new Map();
    let from = start;
    let charge = startingCharge;
    for (let to = nextStops.get(from.id).next; to !== end; to = nextStops.get(from.id).next) {
      const arrival = charge - legConsumption(from, to);
      const next = nextStops.get(to.id).next;
      const departure = reserve + legConsumption(to, next);
      plan.set(to.id, {
        ...chargingEstimate(to, vehicle, arrival, departure),
        fromCharge: Math.round(arrival * 100),
        toCharge: Math.round(departure * 100)
      });
      from = to;
      charge = departure;
    }
    return plan;
  }

  function renderRoutes() {
    const buttons = state.routes.map((route, index) => {
      const button = element('button', 'route-option');
      button.type = 'button';
      button.dataset.routeId = route.id;
      button.setAttribute('aria-pressed', String(route.id === state.selectedRoute));
      button.classList.toggle('is-active', route.id === state.selectedRoute);
      const main = element('span', 'route-option-main');
      main.append(
        element('strong', 'route-option-name', route.name),
        element('small', 'route-option-meta', `${distance(route.distanceKm)} · ${minutes(route.durationMin)}`)
      );
      button.append(main, element('span', 'route-option-tag', index === 0 ? 'Principal' : 'Alternativa'));
      return button;
    });
    routeOptions.replaceChildren(...(buttons.length ? buttons : [
      element('p', 'planner-empty', 'Informe a origem e o destino para consultar as rotas.')
    ]));
  }

  function renderStations() {
    const cards = state.stations.map(station => {
      const active = station.id === state.activeStation;
      const card = element('article', 'station-card');
      card.dataset.stationId = station.id;
      card.classList.toggle('is-active', active);
      const top = element('div', 'station-card-top');
      const mark = element('span', 'station-icon');
      mark.append(icon());
      const info = element('div', 'station-info');
      info.append(element('h3', null, station.name), element('p', null, station.address));
      top.append(mark, info, element('span', 'station-power', station.powerKw ? `${decimal.format(station.powerKw)} kW nominais` : 'Potência s/d'));

      const tags = element('div', 'station-tags');
      tags.append(
        element('span', null, station.connector || 'Conector s/d'),
        element('span', null, `Próximo ao km ${decimal.format(Math.round(station.distanceKm))} da rota`)
      );
      if (station.recommended) tags.append(element('span', 'station-recommended', 'Parada sugerida'));
      if (station.access === 'customers') tags.append(element('span', null, 'Acesso de clientes'));
      if (station.access === 'membership') tags.append(element('span', null, 'Requer cadastro'));
      if (station.access === 'notice') tags.append(element('span', null, 'Requer aviso prévio'));

      const metrics = element('div', 'station-metrics');
      const price = station.pricePerKwh === null ? 'Não informada' : station.pricePerKwh === 0 ? 'Grátis' : money.format(station.pricePerKwh);
      const chargingTime = station.estimatedMinutes === null ? 'Indisponível' : minutes(station.estimatedMinutes);
      const cost = station.estimatedCost === null ? 'Indisponível' : money.format(station.estimatedCost);
      metrics.append(
        metric('Tarifa cadastrada / kWh', price),
        metric(`Tempo mínimo teórico · ${station.fromCharge}–${station.toCharge}%`, chargingTime),
        metric('Custo de energia estimado', cost)
      );
      const select = element('button', 'station-select', active ? 'Selecionada no mapa' : 'Ver no mapa');
      select.type = 'button';
      select.setAttribute('aria-pressed', String(active));
      card.append(top, tags, metrics, select);
      if (station.osmUrl) {
        card.append(externalLink('Ver no OpenStreetMap ↗', station.osmUrl, 'station-source'));
      } else if (station.id.startsWith('ocm-')) {
        const stationUrl = `https://openchargemap.org/site/poi/details/${station.id.slice(4)}`;
        card.append(externalLink('Open Charge Map · base de abr/2026 ↗', stationUrl, 'station-source'));
      }
      return card;
    });
    const empty = !state.selectedRoute ? 'Calcule uma rota para consultar estações pelo caminho.'
      : state.stationsPending ? 'Buscando estações perto desta rota…'
      : state.stationsUnavailable ? 'O serviço de estações está indisponível. Tente consultar novamente.'
        : 'Nenhuma estação encontrada na base consultada perto desta rota.';
    stationList.replaceChildren(...(cards.length ? cards : [element('p', 'planner-empty', empty)]));
    setText('station-count', !state.selectedRoute ? 'Aguardando rota' : state.stationsPending && !cards.length
      ? 'Buscando estações…'
      : `${state.stations.length} ${state.stations.length === 1 ? 'estação' : 'estações'}`);
  }

  function publishMap() {
    const { routes, selectedRoute, stations, activeStation, origin, destination } = state;
    document.dispatchEvent(new CustomEvent('eletricities:map', {
      detail: { routes, selectedRoute, stations, activeStation, origin, destination }
    }));
  }

  function render() {
    const route = state.routes.find(candidate => candidate.id === state.selectedRoute);
    if (!route) {
      renderRoutes();
      renderStations();
      publishMap();
      return;
    }
    const vehicle = vehicles[vehicleInput.value];
    const charge = batteryInput?.valueAsNumber;
    const hasCharge = Number.isFinite(charge) && charge >= 0 && charge <= 100;
    const fromOpenStreetMap = nearbyStations(route, state.stationSource);
    const stations = fromOpenStreetMap.length ? fromOpenStreetMap : nearbyStations(route, stationSnapshot);
    const plan = vehicle && hasCharge ? chargingPlan(route, stations, vehicle, charge / 100) : null;
    state.stations = stations.map(station => {
      const recommendation = plan?.get(station.id);
      const sample = station.current && vehicle
        ? chargingEstimate(station, vehicle, 0.10, 0.80)
        : { estimatedCost: null, estimatedMinutes: null };
      return { ...station, ...sample, fromCharge: 10, toCharge: 80, ...recommendation, recommended: Boolean(recommendation) };
    });
    if (!state.stations.some(station => station.id === state.activeStation)) {
      state.activeStation = null;
    }
    const stops = plan ? [...plan.values()] : null;
    const totalCost = stops?.every(stop => stop.estimatedCost !== null)
      ? money.format(stops.reduce((sum, stop) => sum + stop.estimatedCost, 0)) : '—';
    const totalCharge = stops?.every(stop => stop.estimatedMinutes !== null)
      ? minutes(stops.reduce((sum, stop) => sum + stop.estimatedMinutes, 0)) : '—';
    setText('route-distance', distance(route.distanceKm));
    setText('route-duration', minutes(route.durationMin));
    setText('route-stops', stops ? String(stops.length) : '—');
    setText('route-cost', totalCost);
    setText('route-charge', totalCharge);
    setText('route-plan-note', !vehicle ? 'Selecione o modelo para estimar a recarga. Informe também a bateria na partida para calcular paradas e totais.'
      : !hasCharge ? 'Informe a bateria na partida para calcular paradas e totais.'
      : state.stationsPending && !stations.length ? 'Buscando estações para calcular as paradas.'
      : plan
      ? 'Planejamento com autonomia de referência do Inmetro, reserva de 10% e recarga de até 80% por parada.'
      : 'As estações compatíveis da base não permitem calcular uma sequência de paradas com reserva de 10%.');
    renderRoutes();
    renderStations();
    publishMap();
  }

  function selectStation(id, openMap = false) {
    if (!state.stations.some(station => station.id === id)) return;
    state.activeStation = id;
    renderStations();
    publishMap();
    if (openMap && routeMap) {
      routeMap.tabIndex = -1;
      routeMap.focus({ preventScroll: true });
      routeMap.scrollIntoView({ block: 'center' });
    }
  }

  function selectRoute(id, returnFocus = false) {
    if (!state.routes.some(route => route.id === id) || state.selectedRoute === id) return;
    state.selectedRoute = id;
    render();
    if (returnFocus) routeOptions.querySelector(`[data-route-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }

  function setResult({ origin, destination, routes }) {
    Object.assign(state, {
      origin, destination, routes, stationsPending: true, stationsUnavailable: false,
      selectedRoute: routes[0].id, stationSource: [], activeStation: null
    });
    const mapLabel = byId('map-mode')?.querySelector('span');
    if (mapLabel) mapLabel.textContent = 'MAPA DA ROTA';
    render();
  }

  function setBusy(busy) {
    form.setAttribute('aria-busy', String(busy));
    if (submit) submit.disabled = busy;
  }

  async function fetchData(url, signal, timeout, options) {
    const request = new AbortController();
    const abortRequest = () => request.abort();
    if (signal.aborted) abortRequest();
    else signal.addEventListener('abort', abortRequest, { once: true });
    const timer = setTimeout(abortRequest, timeout);
    try {
      const response = await fetch(url, { ...options, signal: request.signal });
      if (!response.ok) throw new Error('Serviço indisponível');
      return await response.json();
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abortRequest);
    }
  }

  function getLocalPlace(query) {
    const key = normalize(query).replace(/[\s,/-]+/g, ' ');
    return cities.find(city =>
      [city.name, city.name.split(',')[0]].some(name => normalize(name).replace(/[\s,/-]+/g, ' ') === key)
    );
  }

  async function resolvePlace(query, signal) {
    const key = normalize(query);
    const local = getLocalPlace(query) || state.places.get(key);
    if (local) return local;

    const params = new URLSearchParams({ q: query, countrycode: 'BR', limit: '5' });
    let data;
    try {
      data = await fetchData(`https://photon.komoot.io/api/?${params}`, signal, 12000);
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error(`A busca de locais está indisponível para “${query}”. Tente novamente ou selecione uma cidade sugerida.`);
    }
    const result = data.features?.find(feature =>
      feature.properties?.countrycode === 'BR' &&
      feature.geometry?.type === 'Point' &&
      feature.geometry.coordinates?.length === 2 &&
      feature.geometry.coordinates.every(Number.isFinite)
    );
    if (!result) throw new Error(`Não encontrei “${query}” no Brasil. Informe a cidade e o estado.`);
    const [longitude, latitude] = result.geometry.coordinates;
    const { name, city, state: region } = result.properties;
    const place = { name: [...new Set([name, city, region].filter(Boolean))].join(', '), latitude, longitude };
    state.places.set(key, place);
    return place;
  }

  async function fetchRoutes(origin, destination, signal) {
    const coordinates = [origin, destination].map(place => `${place.longitude},${place.latitude}`).join(';');
    const cached = state.routeCache.get(coordinates);
    if (cached) return cached;
    let routes = [];
    let receivedResponse = false;
    for (const service of [
      'https://routing.openstreetmap.de/routed-car',
      'https://router.project-osrm.org'
    ]) {
      try {
        const data = await fetchData(
          `${service}/route/v1/driving/${coordinates}?alternatives=true&geometries=geojson&overview=full&steps=false`,
          signal,
          15000
        );
        receivedResponse = true;
        routes = (Array.isArray(data.routes) ? data.routes : [])
          .filter(route => route.geometry?.coordinates?.length > 1 &&
            Number.isFinite(route.distance) && Number.isFinite(route.duration))
          .slice(0, 3);
        if (routes.length) break;
      } catch (error) {
        if (signal.aborted) throw error;
      }
    }
    if (!routes.length) {
      throw new Error(receivedResponse
        ? 'Nenhuma rota de carro foi encontrada entre os locais informados.'
        : 'Os serviços de rotas estão indisponíveis. Tente novamente em instantes.');
    }
    const results = routes.map((route, index) => {
      const summary = route.legs?.map(leg => leg.summary).filter(Boolean).join(' · ');
      return {
        id: `route-${index}`,
        name: summary ? `Via ${summary}` : index === 0 ? 'Rota principal' : `Alternativa ${index}`,
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        coordinates: route.geometry.coordinates.map(([lon, lat]) => [lat, lon])
      };
    });
    state.routeCache.set(coordinates, results);
    return results;
  }

  function stationPower(value) {
    const units = { w: 0.001, kw: 1, mw: 1000 };
    const powers = (value ?? '').split(';').flatMap(part => {
      const parsed = part.match(/^\s*(\d+(?:[.,]\d+)?)\s*(w|kw|mw)?\s*$/i);
      if (!parsed) return [];
      const power = Number(parsed[1].replace(',', '.')) * units[(parsed[2] ?? 'kw').toLowerCase()];
      return Number.isFinite(power) && power > 0 ? [power] : [];
    });
    return powers.length ? Math.max(...powers) : null;
  }

  function stationPrice(tags) {
    if (tags['charge:conditional'] || tags['fee:conditional'] || tags['charge:charging:conditional'] || tags['fee:charging:conditional']) return null;
    const text = tags['charge:charging'] ?? tags.charge ?? '';
    const price = text.match(/^\s*(?:(?:BRL|R\$)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:BRL|R\$))\s*(?:\/|per|por)\s*kWh\s*$/i);
    if (price) {
      const amount = Number((price[1] ?? price[2]).replace(',', '.'));
      return Number.isFinite(amount) ? amount : null;
    }
    return !text && (tags['fee:charging'] ?? tags.fee) === 'no' ? 0 : null;
  }

  function parseStation(item) {
    const { tags = {}, center, type, id } = item;
    const latitude = item.lat ?? center?.lat;
    const longitude = item.lon ?? center?.lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || ['private', 'no'].includes(tags.access)) return null;
    if (tags.motorcar === 'no' || tags.bicycle === 'designated') return null;
    const sockets = [
      ['type2_combo', 'CCS2', 'DC'], ['type2', 'Tipo 2', 'AC'], ['type2_cable', 'Tipo 2', 'AC'],
      ['chademo', 'CHAdeMO'], ['type1', 'Tipo 1']
    ];
    const hasSocket = type =>
      tags[`socket:${type}:output`] || (tags[`socket:${type}`] && !/^(no|0)$/.test(tags[`socket:${type}`]));
    const [socket, connector, current] = sockets.find(([type]) => hasSocket(type)) ?? [];
    const powerKw = stationPower(tags[`socket:${socket}:output`]);
    const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ');
    return {
      id: `osm-${type}-${id}`,
      name: tags.name ?? tags.operator ?? tags.brand ?? 'Estação de recarga',
      address: [street, tags['addr:city']].filter(Boolean).join(' · ') || tags['addr:place'] || 'Localização no mapa',
      latitude, longitude, powerKw,
      connector: connector ?? null,
      current: current ?? null,
      access: tags.access,
      pricePerKwh: stationPrice(tags),
      osmUrl: `https://www.openstreetmap.org/${type}/${id}`
    };
  }

  function extendBounds([south, west, north, east], [lat, lon]) {
    return [Math.min(south, lat), Math.min(west, lon), Math.max(north, lat), Math.max(east, lon)];
  }

  function routeBounds(routes) {
    const empty = [Infinity, Infinity, -Infinity, -Infinity];
    const area = ([south, west, north, east]) => (north - south + 0.2) * (east - west + 0.2);
    const all = routes.reduce((bounds, route) => route.coordinates.reduce(extendBounds, bounds), empty);
    const regions = [];
    if (area(all) <= 6) {
      regions.push(all);
    } else {
      for (const route of routes) {
        let bounds = empty;
        let previous = route.coordinates[0];
        for (const point of route.coordinates) {
          const expanded = extendBounds(bounds, point);
          if (area(expanded) > 3 && area(bounds) <= 3) {
            regions.push(bounds);
            bounds = extendBounds(extendBounds(empty, previous), point);
          } else {
            bounds = expanded;
          }
          previous = point;
        }
        regions.push(bounds);
      }
    }

    // Rounded, padded boxes let Overpass use its spatial index. The exact
    // corridor is applied client-side by nearbyStations.
    return [...new Set(regions.map(([south, west, north, east]) =>
      [Math.floor((south - 0.08) * 10), Math.floor((west - 0.08) * 10),
        Math.ceil((north + 0.08) * 10), Math.ceil((east + 0.08) * 10)]
        .map(value => (value / 10).toFixed(1)).join(',')
    ))];
  }

  async function fetchStations(routes, signal) {
    const queries = routeBounds(routes).map(bounds => `nwr["amenity"="charging_station"](${bounds});`);
    const query = `[out:json][timeout:8];(${queries.join('')});out center;`;
    const cached = state.stationCache.get(query);
    if (cached) return cached;
    const params = new URLSearchParams({ data: query });
    for (const host of ['overpass-api.de', 'overpass.private.coffee']) {
      try {
        const data = await fetchData(`https://${host}/api/interpreter`, signal, 9000, { method: 'POST', body: params });
        if (!data.remark && Array.isArray(data.elements)) {
          const stations = data.elements.map(parseStation).filter(Boolean);
          state.stationCache.set(query, stations);
          return stations;
        }
      } catch (error) {
        if (signal.aborted) throw error;
      }
    }
    throw new Error('Serviço de estações indisponível');
  }

  async function planTrip(event) {
    event.preventDefault();
    const originQuery = originInput.value.trim();
    const destinationQuery = destinationInput.value.trim();
    if (!originQuery || !destinationQuery) {
      showStatus('Informe a origem e o destino para calcular a rota.', 'error');
      (originQuery ? destinationInput : originInput).focus();
      return;
    }
    const localOrigin = getLocalPlace(originQuery);
    const localDestination = getLocalPlace(destinationQuery);
    if (normalize(originQuery) === normalize(destinationQuery) || (localOrigin && localOrigin === localDestination)) {
      showStatus('Escolha uma origem e um destino diferentes.', 'error');
      destinationInput.focus();
      return;
    }

    state.pending?.abort();
    const request = new AbortController();
    state.pending = request;
    const { signal } = request;
    setBusy(true);
    showStatus(state.selectedRoute
      ? 'Consultando nova rota. O mapa mantém a última rota consultada durante a busca.'
      : 'Consultando rota…', 'loading');
    try {
      const [origin, destination] = await Promise.all([
        resolvePlace(originQuery, signal),
        resolvePlace(destinationQuery, signal)
      ]);
      if (Math.hypot(origin.latitude - destination.latitude, origin.longitude - destination.longitude) < 0.0001) {
        throw new Error('Escolha uma origem e um destino diferentes.');
      }
      const routes = await fetchRoutes(origin, destination, signal);
      if (signal.aborted) return;
      setResult({ origin, destination, routes });
      const snapshotAvailable = routes.some(route => nearbyStations(route, stationSnapshot).length > 0);
      showStatus('Rota consultada no OpenStreetMap. Buscando estações de recarga…', 'loading');
      if (snapshotAvailable) appendSnapshotSource();
      let stations = [];
      let stationsUnavailable = false;
      try {
        stations = await fetchStations(routes, signal);
      } catch {
        stationsUnavailable = true;
      }
      if (signal.aborted) return;
      Object.assign(state, { stationSource: stations, stationsUnavailable, stationsPending: false });
      render();
      showStatus(stationsUnavailable
        ? 'Rota consultada no OpenStreetMap. A consulta de estações do OpenStreetMap está indisponível.'
        : 'Rota e consulta de estações pelo OpenStreetMap.', stationsUnavailable ? 'warning' : 'live');
      if (snapshotAvailable) appendSnapshotSource();
    } catch (error) {
      if (signal.aborted) return;
      const detail = error?.message ?? '';
      const message = /^(Não encontrei|Nenhuma rota|Escolha uma origem|A busca de locais|Os serviços de rotas)/.test(detail)
        ? detail : 'A consulta de rota está indisponível. Tente novamente.';
      const previous = state.selectedRoute ? ' O mapa mantém a última rota consultada.' : '';
      showStatus(message + previous, 'error');
      if (state.stations.some(station => station.id.startsWith('ocm-'))) appendSnapshotSource();
      if (state.selectedRoute) {
        const mapLabel = byId('map-mode')?.querySelector('span');
        if (mapLabel) mapLabel.textContent = 'ÚLTIMA ROTA';
      }
    } finally {
      if (state.pending === request) {
        state.pending = null;
        setBusy(false);
      }
    }
  }

  form.addEventListener('submit', planTrip);
  byId('swap-route')?.addEventListener('click', () => {
    [originInput.value, destinationInput.value] = [destinationInput.value, originInput.value];
  });
  routeOptions.addEventListener('click', event => {
    const button = event.target.closest('button[data-route-id]');
    if (button) selectRoute(button.dataset.routeId, true);
  });
  stationList.addEventListener('click', event => {
    const button = event.target.closest('.station-select');
    if (button) selectStation(button.closest('[data-station-id]').dataset.stationId, true);
  });
  document.addEventListener('eletricities:station', event => selectStation(event.detail.id));
  document.addEventListener('eletricities:route', event => selectRoute(event.detail.id));
  vehicleInput.addEventListener('change', render);
  batteryInput?.addEventListener('input', render);

  const modelPrompt = element('option', null, 'Selecione o modelo');
  modelPrompt.value = '';
  vehicleInput.replaceChildren(modelPrompt, ...Object.entries(vehicles).map(([id, vehicle]) => {
    const option = element('option', null, vehicle.name);
    option.value = id;
    return option;
  }));
  byId('city-suggestions')?.replaceChildren(...cities.map(city => {
    const option = element('option');
    option.value = city.name;
    return option;
  }));
  render();
})();
