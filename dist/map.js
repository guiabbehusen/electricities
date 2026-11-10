(() => {
  const host = document.querySelector('#route-map, #planner-map');
  if (!host) return;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const tileSize = 256;
  const icons = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    center: '<circle cx="12" cy="12" r="6"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3"/>',
    bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7z" fill="currentColor" stroke="none"/>',
    flag: '<path d="M5 21V4m0 1c5-4 8 4 14 0v9c-6 4-9-4-14 0"/>',
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  }

  const style = document.createElement('style');
  style.textContent = `
    .ec-map { position:relative; isolation:isolate; overflow:hidden; background:#e9ede6; }
    .ec-map-scene { position:absolute; inset:0; overflow:hidden; cursor:grab; touch-action:pan-y; outline:none; }
    .ec-map-scene:focus-visible { outline:2px solid #138d57; outline-offset:-3px; }
    .ec-map-scene.is-dragging { cursor:grabbing; }
    .ec-map-tiles,.ec-map-routes,.ec-map-markers { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
    .ec-map-tiles,.ec-map-routes { display:block; }
    .ec-map-tiles img { position:absolute; max-width:none; user-select:none; filter:saturate(.36) contrast(.9) brightness(1.055); }
    .ec-map-tiles img[hidden] { display:none; }
    .ec-map-routes path { fill:none; stroke-linecap:round; stroke-linejoin:round; }
    .ec-map-route-alt { stroke:#9eb6a8; stroke-width:4; stroke-dasharray:5 7; }
    .ec-map-route-target { stroke:transparent; stroke-width:15; pointer-events:stroke; cursor:pointer; }
    .ec-map-route-outline { stroke:#fff; stroke-width:10; opacity:.96; }
    .ec-map-route-main { stroke:#13985c; stroke-width:5.5; }
    .ec-map-marker { position:absolute; display:grid; place-items:center; transform:translate(-50%,-50%); }
    .ec-map-marker[hidden] { display:none; }
    .ec-map-station { width:34px; height:34px; padding:0; border:2px solid #fff; border-radius:50%; background:#15251d; color:#b7fb76; cursor:pointer; pointer-events:auto; box-shadow:0 3px 10px #102a2240; }
    .ec-map-station svg { width:17px; height:17px; }
    .ec-map-station:is(:hover,:focus-visible,[aria-pressed=true]) { z-index:2; background:#aff177; color:#10281b; }
    .ec-map-station[aria-pressed=true] { box-shadow:0 0 0 4px #77cf7a66,0 3px 10px #102a2240; }
    .ec-map-endpoint { width:17px; height:17px; border:3px solid #fff; border-radius:50%; background:#13985c; box-shadow:0 1px 7px #102a2250; }
    .ec-map-endpoint.is-destination { width:26px; height:26px; border-width:2px; background:#15251d; color:#b7fb76; }
    .ec-map-endpoint svg { width:14px; height:14px; }
    .ec-map-marker-label { position:absolute; top:calc(100% + 6px); left:50%; transform:translateX(-50%); color:#20372d; font:700 11px/1.2 system-ui,sans-serif; white-space:nowrap; text-shadow:0 0 3px #fff,0 1px 2px #fff,1px 0 1px #fff,-1px 0 1px #fff; }
    .ec-map-station .ec-map-marker-label { display:none; top:auto; bottom:calc(100% + 7px); padding:6px 8px; border-radius:5px; color:#fff; background:#15251d; text-shadow:none; }
    .ec-map-station:is(:hover,:focus-visible) .ec-map-marker-label { display:block; }
    .ec-map-controls { position:absolute; z-index:1; right:14px; bottom:26px; display:flex; flex-direction:column; gap:6px; }
    .ec-map-zoom { overflow:hidden; border-radius:9px; box-shadow:0 1px 6px #19372c26; }
    .ec-map-controls button { display:grid; place-items:center; width:34px; height:34px; padding:0; border:0; background:#fff; color:#263b31; cursor:pointer; }
    .ec-map-controls button + button { border-top:1px solid #e8ede8; }
    .ec-map-controls button:hover { background:#f1f8ed; }
    .ec-map-controls button:focus-visible { position:relative; z-index:1; outline:2px solid #218b50; outline-offset:-2px; }
    .ec-map-controls button:disabled { color:#9aa5a0; cursor:default; }
    .ec-map-controls svg { width:16px; height:16px; }
    .ec-map-controls .ec-map-recenter { border-radius:9px; box-shadow:0 1px 6px #19372c26; }
    .ec-map-notice { position:absolute; bottom:65px; left:50%; transform:translateX(-50%); width:max-content; max-width:calc(100% - 102px); padding:6px 9px; border:1px solid #d9e1d6; border-radius:7px; background:#fffffff0; color:#43534d; font:600 11px/1.35 system-ui,sans-serif; text-align:center; pointer-events:none; }
    .ec-map-credit { position:absolute; right:0; bottom:0; padding:3px 7px; background:#ffffffe3; border-top-left-radius:5px; color:#43534d; font:10px/1.3 system-ui,sans-serif; }
    .ec-map-credit a { color:inherit; text-decoration:underline; }
    @media (max-width:600px) {
      .ec-map-controls { right:10px; }
      .ec-map-station { width:29px; height:29px; }
      .ec-map-station svg { width:15px; height:15px; }
      .ec-map-marker-label { font-size:9px; }
    }
  `;
  document.head.append(style);

  host.classList.add('ec-map');
  const scene = document.createElement('div');
  scene.className = 'ec-map-scene';
  scene.tabIndex = 0;
  scene.setAttribute('role', 'region');
  scene.setAttribute('aria-label', 'Mapa de recarga. Use as setas para mover, + ou − para aproximar ou afastar e Home para centralizar.');
  scene.innerHTML = '<div class="ec-map-tiles" aria-hidden="true"></div><svg class="ec-map-routes" aria-hidden="true"></svg><div class="ec-map-markers"></div>';
  const [tileLayer, routeLayer, markerLayer] = scene.children;

  const controls = document.createElement('div');
  controls.className = 'ec-map-controls';
  controls.innerHTML = `<div class="ec-map-zoom">
    <button type="button" aria-label="Aproximar mapa" title="Aproximar">${icon('plus')}</button>
    <button type="button" aria-label="Afastar mapa" title="Afastar">${icon('minus')}</button>
  </div><button class="ec-map-recenter" type="button" aria-label="Centralizar no Brasil" title="Centralizar no Brasil">${icon('center')}</button>`;
  const [zoomIn, zoomOut, recenter] = controls.querySelectorAll('button');

  const credit = document.createElement('div');
  credit.className = 'ec-map-credit';
  credit.innerHTML = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  const notice = document.createElement('div');
  notice.className = 'ec-map-notice';
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  host.prepend(scene, notice, controls, credit);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const bounds = { minZoom: 2, maxZoom: 17 };
  const brazilView = [[-34, -74], [5.5, -34.5]];
  let view = { ...project([-14, -52]), zoom: bounds.minZoom };
  let data = { routes: [], stations: [] };
  let selectedRoute;
  let markers = [];
  const tileImages = new Map();
  let frame = 0;
  let drag;
  let suppressRouteClick = false;
  let selectedGeometry;
  let tilesReady = typeof IntersectionObserver !== 'function';
  let tileObserver;

  function activateMapTiles() {
    if (tilesReady) return;
    tilesReady = true;
    tileObserver?.disconnect();
    tileObserver = null;
    requestDraw();
  }

  function project([latitude, longitude]) {
    const rad = clamp(latitude, -85.051128, 85.051128) * Math.PI / 180;
    return { x: (longitude + 180) / 360, y: (1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 };
  }

  function scale() {
    return tileSize * 2 ** view.zoom;
  }

  function offset() {
    const size = scale();
    return { x: view.x * size - scene.clientWidth / 2, y: view.y * size - scene.clientHeight / 2 };
  }

  function screenPoint(location, size, topLeft) {
    const point = project(location);
    const x = point.x + Math.round(view.x - point.x);
    return { x: x * size - topLeft.x, y: point.y * size - topLeft.y };
  }

  function coordinates(point) {
    return [point?.latitude ?? point?.lat, point?.longitude ?? point?.lon];
  }

  function isCoordinate(point) {
    return Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]);
  }

  function makePath(points, size, topLeft) {
    let path = '';
    let last = null;
    for (const location of points) {
      if (!isCoordinate(location)) continue;
      const point = screenPoint(location, size, topLeft);
      const current = `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      if (current === last) continue;
      path += `${path ? 'L' : 'M'}${current}`;
      last = current;
    }
    return path;
  }

  function addPath(container, className, path) {
    const element = document.createElementNS(svgNamespace, 'path');
    element.setAttribute('class', className);
    element.setAttribute('d', path);
    container.append(element);
    return element;
  }

  function addMarker(location, label, kind, id) {
    if (!isCoordinate(location)) return;
    const pin = document.createElement(kind === 'station' ? 'button' : 'div');
    pin.className = `ec-map-marker ec-map-${kind === 'station' ? 'station' : `endpoint is-${kind}`}`;
    const name = document.createElement('span');
    name.className = 'ec-map-marker-label';
    name.textContent = label;
    if (kind === 'station') {
      pin.type = 'button';
      pin.innerHTML = icon('bolt');
      pin.setAttribute('aria-label', label);
      pin.addEventListener('click', () => document.dispatchEvent(new CustomEvent('eletricities:station', { detail: { id } })));
    }
    if (kind === 'destination') pin.innerHTML = icon('flag');
    if (label) pin.append(name);
    markerLayer.append(pin);
    markers.push({ pin, location, id });
  }

  function prepareMarkers() {
    markerLayer.replaceChildren();
    markers = [];
    if (!selectedRoute) return;
    const route = selectedRoute.coordinates;
    const origin = coordinates(data.origin);
    const destination = coordinates(data.destination);
    addMarker(isCoordinate(origin) ? origin : route[0], data.origin?.name, 'origin');
    addMarker(isCoordinate(destination) ? destination : route.at(-1), data.destination?.name, 'destination');
    for (const station of data.stations || []) {
      const power = Number.isFinite(station.powerKw) ? ` · ${station.powerKw} kW` : '';
      addMarker(coordinates(station), `${station.name}${power}`, 'station', station.id);
    }
  }

  function selectMarker() {
    for (const { pin, id } of markers) {
      if (id !== undefined) pin.setAttribute('aria-pressed', String(String(id) === String(data.activeStation)));
    }
  }

  function bringMarkerIntoView() {
    if (data.activeStation == null) return;
    const marker = markers.find(({ id }) => String(id) === String(data.activeStation));
    if (!marker) return;
    const point = screenPoint(marker.location, scale(), offset());
    const width = scene.clientWidth;
    const height = scene.clientHeight;
    const margin = 24;
    if (point.x < margin || point.x > width - margin || point.y < margin || point.y > height - margin) {
      moveBy(point.x - width / 2, point.y - height / 2);
    }
  }

  function fitMap() {
    const geometry = selectedRoute?.coordinates ?? brazilView;
    const points = geometry.filter(isCoordinate).map(project);
    if (!points.length || !scene.clientWidth || !scene.clientHeight) return;
    let minX = points[0].x;
    let maxX = minX;
    let minY = points[0].y;
    let maxY = minY;
    for (const point of points) {
      const x = point.x + Math.round(points[0].x - point.x);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const width = scene.clientWidth;
    const height = scene.clientHeight;
    const fitWidth = width * (width < 480 ? .72 : .77);
    const fitHeight = height * .64;
    const xScale = fitWidth / Math.max(maxX - minX, 0.000004);
    const yScale = fitHeight / Math.max(maxY - minY, 0.000004);
    view = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom: clamp(Math.log2(Math.min(xScale, yScale) / tileSize), bounds.minZoom, bounds.maxZoom - 2),
    };
    requestDraw();
  }

  function updateMapNotice() {
    const tiles = [...tileImages.values()];
    const loaded = tiles.some(tile => tile.naturalWidth > 0);
    const pending = tiles.some(tile => !tile.complete);
    let message = '';
    if (!loaded && !pending) {
      message = selectedRoute ? 'Mapa-base indisponível. Trajeto calculado exibido.' : 'Mapa-base indisponível.';
    } else if (!loaded) {
      message = 'Carregando mapa-base…';
    }
    if (notice.textContent !== message) notice.textContent = message;
    notice.hidden = !message;
  }

  function drawTiles(width, height, size, topLeft) {
    if (!tilesReady) return;
    if (!/^https?:$/.test(location.protocol)) {
      updateMapNotice();
      return;
    }
    const zoom = Math.floor(view.zoom);
    const tileCount = 2 ** zoom;
    const displaySize = size / tileCount;
    const left = Math.floor(topLeft.x / displaySize);
    const right = Math.floor((topLeft.x + width) / displaySize);
    const top = Math.max(0, Math.floor(topLeft.y / displaySize));
    const bottom = Math.min(tileCount - 1, Math.floor((topLeft.y + height) / displaySize));
    const visible = new Set();
    for (let x = left; x <= right; x++) {
      for (let y = top; y <= bottom; y++) {
        const id = `${zoom}/${x}/${y}`;
        visible.add(id);
        let tile = tileImages.get(id);
        if (!tile) {
          tile = document.createElement('img');
          tile.alt = '';
          tile.draggable = false;
          tile.hidden = true;
          tile.decoding = 'async';
          tile.referrerPolicy = 'strict-origin-when-cross-origin';
          tile.addEventListener('load', () => { tile.hidden = false; updateMapNotice(); });
          tile.addEventListener('error', updateMapNotice);
          const tileX = (x % tileCount + tileCount) % tileCount;
          tile.src = `https://tile.openstreetmap.org/${zoom}/${tileX}/${y}.png`;
          tileImages.set(id, tile);
          tileLayer.append(tile);
        }
        tile.style.width = `${displaySize + .5}px`;
        tile.style.height = `${displaySize + .5}px`;
        tile.style.transform = `translate(${x * displaySize - topLeft.x}px,${y * displaySize - topLeft.y}px)`;
      }
    }
    for (const [id, tile] of tileImages) {
      if (!visible.has(id)) {
        tile.remove();
        tileImages.delete(id);
      }
    }
    updateMapNotice();
  }

  function drawRoutes(size, topLeft) {
    routeLayer.replaceChildren();
    for (const route of data.routes || []) {
      if (route === selectedRoute) continue;
      const path = makePath(route.coordinates || [], size, topLeft);
      addPath(routeLayer, 'ec-map-route-alt', path);
      const target = addPath(routeLayer, 'ec-map-route-target', path);
      target.addEventListener('click', () => {
        if (suppressRouteClick) return;
        document.dispatchEvent(new CustomEvent('eletricities:route', { detail: { id: route.id } }));
      });
    }
    if (!selectedRoute) return;
    const path = makePath(selectedRoute.coordinates || [], size, topLeft);
    addPath(routeLayer, 'ec-map-route-outline', path);
    addPath(routeLayer, 'ec-map-route-main', path);
  }

  function draw() {
    frame = 0;
    const width = scene.clientWidth;
    const height = scene.clientHeight;
    if (!width || !height) return;
    const size = scale();
    const topLeft = offset();
    drawTiles(width, height, size, topLeft);
    drawRoutes(size, topLeft);
    for (const { pin, location } of markers) {
      const { x, y } = screenPoint(location, size, topLeft);
      pin.hidden = x < 0 || x > width || y < 0 || y > height;
      pin.style.left = `${x}px`;
      pin.style.top = `${y}px`;
    }
    zoomIn.disabled = view.zoom >= bounds.maxZoom;
    zoomOut.disabled = view.zoom <= bounds.minZoom;
  }

  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function zoomBy(change) {
    activateMapTiles();
    view.zoom = clamp(view.zoom + change, bounds.minZoom, bounds.maxZoom);
    requestDraw();
  }

  function moveBy(x, y) {
    const size = scale();
    view.x = (view.x + x / size + 1) % 1;
    view.y = clamp(view.y + y / size, 0, 1);
    requestDraw();
  }

  zoomIn.addEventListener('click', () => zoomBy(1));
  zoomOut.addEventListener('click', () => zoomBy(-1));
  recenter.addEventListener('click', () => {
    activateMapTiles();
    fitMap();
  });
  host.addEventListener('focusin', activateMapTiles);

  scene.addEventListener('keydown', event => {
    if (event.target !== scene) return;
    const keys = {
      '+': () => zoomBy(1), '=': () => zoomBy(1), '-': () => zoomBy(-1), '−': () => zoomBy(-1),
      ArrowLeft: () => moveBy(-60, 0), ArrowRight: () => moveBy(60, 0),
      ArrowUp: () => moveBy(0, -60), ArrowDown: () => moveBy(0, 60), Home: fitMap,
    };
    if (!Object.hasOwn(keys, event.key)) return;
    activateMapTiles();
    event.preventDefault();
    keys[event.key]();
  });

  scene.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || event.target.closest('button')) return;
    activateMapTiles();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    suppressRouteClick = false;
  });
  scene.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const x = drag.x - event.clientX;
    const y = drag.y - event.clientY;
    if (!drag.moved && Math.hypot(x, y) < 4) return;
    if (!drag.moved) {
      scene.setPointerCapture(event.pointerId);
      scene.classList.add('is-dragging');
      drag.moved = true;
      suppressRouteClick = true;
    }
    moveBy(x, y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  function endDrag() {
    drag = null;
    scene.classList.remove('is-dragging');
  }
  scene.addEventListener('pointerup', endDrag);
  scene.addEventListener('pointercancel', endDrag);
  scene.addEventListener('lostpointercapture', endDrag);
  scene.addEventListener('pointerleave', () => { if (drag && !drag.moved) endDrag(); });

  document.addEventListener('eletricities:map', event => {
    const next = event.detail;
    if (!next) return;
    const route = next.routes?.find(item => item.id === next.selectedRoute) || next.routes?.[0];
    const changedRoute = selectedGeometry !== route?.coordinates;
    const changedMarkers = changedRoute || data.stations !== next.stations || data.origin !== next.origin || data.destination !== next.destination;
    const changedStation = data.activeStation !== next.activeStation;
    data = next;
    selectedRoute = route;
    selectedGeometry = route?.coordinates;
    if (selectedRoute) activateMapTiles();
    if (changedMarkers) prepareMarkers();
    selectMarker();
    if (changedRoute) {
      const label = selectedRoute ? 'Centralizar na rota' : 'Centralizar no Brasil';
      recenter.setAttribute('aria-label', label);
      recenter.title = label;
      fitMap();
    }
    else if (changedStation) bringMarkerIntoView();
    if (changedMarkers) requestDraw();
  });

  new ResizeObserver(fitMap).observe(scene);
  if (!tilesReady) {
    tileObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) activateMapTiles();
    }, { rootMargin: '120px 0px' });
    tileObserver.observe(host);
  }
})();
