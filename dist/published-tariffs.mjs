// Volvo's publication was rechecked on 2026-11-09; EVolt portals on 2026-11-06.
// Each published tariff applies only to
// the identified location/connector, with its original source and effective date.
const volvoLocations = new Set([
  203264, 204433, 260426, 264456, 299167, 299175, 299177, 299178, 299236,
  299237, 300112, 302217, 311522, 460059, 460141, 460616, 461236, 470705, 472977,
  481257
].map(id => `ocm-${id}`));

const volvoSource = 'https://www.volvocars.com/br/media/press-releases/BC28C2E96CE1476C/';
const checkedAt = '2026-11-09';
const evoltCheckedAt = '2026-11-06';
const volvoHighwayLocations = new Set([
  203264, 204433, 260426, 264456, 299177, 299178, 299237, 302217,
  460059, 460141, 460616, 461236, 470705
].map(id => `ocm-${id}`));
const evoltConnectors = {
  'ocm-312959': { price: 1.64, powerKw: 60, charger: 'KINSOL-109', title: 'Kinsol Mourisco' },
  'ocm-312960': { price: 1.99, powerKw: 60, charger: 'KINSOL-107', title: 'Kinsol Puglia' }
};

export function applyPublishedTariffs(stations) {
  return stations.map(station => {
    if (volvoLocations.has(station.id) && station.current === 'DC') {
      return {
        ...station,
        pricePerKwh: 2.90,
        activationFee: 2.50,
        idleFeePerMinute: volvoHighwayLocations.has(station.id) ? 5 : null,
        idleGraceMinutes: volvoHighwayLocations.has(station.id) ? 15 : null,
        canEstimateCost: true,
        priceSourceUrl: volvoSource,
        priceSourceTitle: 'Volvo Car Brasil · tabela da rede',
        pricePublishedAt: '2026-06-02',
        priceEffectiveFrom: '2026-06-15',
        priceSourceCheckedAt: checkedAt,
        priceScope: 'Carregador rápido DC do ponto listado pela Volvo',
        tariffDetails: [
          { label: 'Energia DC', value: 'R$ 2,90/kWh' },
          { label: 'Conectividade', value: 'R$ 2,50 por sessão' },
          { label: 'Ociosidade', value: 'R$ 5,00/min após 15 minutos de tolerância, a partir do 16º minuto, nos rápidos em rodovias' }
        ]
      };
    }
    const evolt = evoltConnectors[station.id];
    if (evolt && station.current === 'DC' && station.powerKw === evolt.powerKw) {
      return {
        ...station,
        pricePerKwh: evolt.price,
        activationFee: null,
        idleFeePerMinute: null,
        idleGraceMinutes: null,
        canEstimateCost: true,
        priceSourceUrl: `https://app.evoltbr.com/#/charger/${evolt.charger}/2`,
        priceSourceTitle: `EVoltBR · ${evolt.title}`,
        pricePublishedAt: null,
        priceEffectiveFrom: null,
        priceSourceCheckedAt: evoltCheckedAt,
        priceScope: `Conector esquerdo ID 2 · CCS2 · ${evolt.powerKw} kW`,
        tariffDetails: [
          { label: 'Energia no conector esquerdo ID 2', value: `R$ ${evolt.price.toFixed(2).replace('.', ',')}/kWh` },
          { label: 'Conferência', value: 'Preço exibido no portal público da operadora em 06/11/2026' }
        ]
      };
    }
    return station;
  });
}
