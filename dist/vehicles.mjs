// Brazilian-market versions. Range is PBEV/Inmetro, never WLTP or NEDC.
// `usable` is used only where the manufacturer explicitly publishes usable energy.
// `nominal` denotes the manufacturer's declared battery capacity; it is not a
// claim that the entire pack can be discharged or that charging losses are known.
const checkedAt = '2026-11-09';
const bydSheets = 'https://www.byd.com/material/__CN/byd-site/br/fichas-tecnicas-2026/update-13-07-2026/07-13-2026---ficha-txiunica/';
const bydYears = 'https://www.byd.com/br/historico-condicoes';
const bydConditions = 'https://www.byd.com/br/condicoes';
const bydLaunch = 'https://www.byd.com/br/byd-lan%C3%A7a-dolphin-special-edition-e-yuan-plus-2027-tra%C3%A7%C3%A3o-integral';
const volvoSheet = 'https://www.volvocars.com/images/cs/v3/assets/blt84e01a6904dbd2e8/bltdc4437137eec679e/681332dd924f57737f7a3d4b/EX30_Model_Year_25.5.pdf?branch=prod_alias';
const volvoRange = 'https://www.volvocars.com/br/media/press-releases/6BB4518DE21F69F5/';
const volvoPort = 'https://www.volvocars.com/br/support/car/ex30/article/ca1e9a24d3421219c0a8cc37269316b0-10380ca79f5ecabbc0a8b0c1144d887b-8664b2fa77a7e089c0a8296870d1a409/';
const geelyEx2Sheet = 'https://static.autoforce.com/plugins/files/clientes/geely-brasil/produtos/ws/Ficha_Tecnica_GEELY_EX2.pdf';
const geelyEx5Sheet = 'https://static.autoforce.com/plugins/files/clientes/geely-brasil/produtos/ws/ficha-tecnica-geely-ex5-v2.pdf';

export const vehicles = {
  dolphin: {
    name: 'BYD Dolphin GS 2027',
    capacity: 44.9, capacityBasis: 'nominal', rangeKm: 291,
    dcKw: 60, acKw: 6.6, modelYear: 2027, connector: 'CCS2', checkedAt,
    sourceUrl: `${bydSheets}BYD_DolphinGS_V2.pdf`,
    sourceTitle: 'BYD Brasil — ficha técnica Dolphin GS, revisão de julho de 2026',
    modelYearSourceUrl: bydYears,
    sourceUrls: ['https://www.byd.com/br/car/dolphin', bydYears],
  },
  'dolphin-mini': {
    name: 'BYD Dolphin Mini GS 2027',
    capacity: 38.88, capacityBasis: 'nominal', rangeKm: 280,
    dcKw: 40, acKw: 6.6, modelYear: 2027, connector: 'CCS2', checkedAt,
    sourceUrl: `${bydSheets}BYD_DolphinMini_V2.pdf`,
    sourceTitle: 'BYD Brasil — ficha técnica Dolphin Mini GL e GS, revisão de julho de 2026',
    modelYearSourceUrl: bydYears,
    sourceUrls: ['https://www.byd.com/br/car/dolphin-mini', bydYears],
  },
  'dolphin-mini-gl': {
    name: 'BYD Dolphin Mini GL 2027',
    capacity: 30.08, capacityBasis: 'nominal', rangeKm: 224,
    dcKw: 30, acKw: 6.6, modelYear: 2027, connector: 'CCS2', checkedAt,
    sourceUrl: `${bydSheets}BYD_DolphinMini_V2.pdf`,
    sourceTitle: 'BYD Brasil — ficha técnica Dolphin Mini GL e GS, revisão de julho de 2026',
    modelYearSourceUrl: bydYears,
    sourceUrls: ['https://www.byd.com/br/car/dolphin-mini', bydYears],
  },
  'dolphin-plus': {
    name: 'BYD Dolphin Plus 2025',
    capacity: 60.48, capacityBasis: 'nominal', rangeKm: 330,
    dcKw: 80, acKw: 11, modelYear: 2025, connector: 'CCS2', checkedAt,
    sourceUrl: `${bydSheets}BYD_DolphinPlus_V2.pdf`,
    sourceTitle: 'BYD Brasil — ficha técnica Dolphin Plus, revisão de julho de 2026',
    modelYearSourceUrl: 'https://www.byd.com/br/noticias-byd-brasil/byd-lanca-dolphin-mini-azul-e-song-pro-com-adas-completo.html',
    sourceUrls: ['https://www.byd.com/br/car/dolphin-plus'],
  },
  'dolphin-se': {
    name: 'BYD Dolphin Special Edition',
    capacity: 45.12, capacityBasis: 'nominal', rangeKm: 272,
    dcKw: 80, acKw: 6.6, connector: 'CCS2', checkedAt,
    sourceUrl: `${bydSheets}BYD_DolphinSE_V2.pdf`,
    sourceTitle: 'BYD Brasil — ficha técnica Dolphin Special Edition, revisão de julho de 2026',
    sourceUrls: ['https://www.byd.com/br/car/dolphin-se', bydLaunch],
  },
  seal: {
    name: 'BYD Seal AWD 2027',
    capacity: 82.56, capacityBasis: 'nominal', rangeKm: 372,
    dcKw: 150, acKw: 6.6, modelYear: 2027, connector: 'CCS2', checkedAt,
    sourceUrl: `${bydSheets}BYD_Seal_V2.pdf`,
    sourceTitle: 'BYD Brasil — ficha técnica Seal, revisão de julho de 2026',
    modelYearSourceUrl: bydConditions,
    sourceUrls: ['https://www.byd.com/br/car/seal', bydConditions],
  },
  'yuan-pro': {
    name: 'BYD Yuan Pro 2027',
    capacity: 45.12, capacityBasis: 'nominal', rangeKm: 250,
    dcKw: 65, acKw: 6.6, modelYear: 2027, connector: 'CCS2', checkedAt,
    sourceUrl: `${bydSheets}BYD_YuanPro_V2.pdf`,
    sourceTitle: 'BYD Brasil — ficha técnica Yuan Pro, revisão de julho de 2026',
    modelYearSourceUrl: bydConditions,
    sourceUrls: [bydConditions],
  },
  'yuan-plus-awd': {
    name: 'BYD Yuan Plus AWD 2027',
    capacity: 74.88, capacityBasis: 'nominal', rangeKm: 378,
    dcKw: 205, acKw: 11, modelYear: 2027, connector: 'CCS2', checkedAt,
    sourceUrl: `${bydSheets}BYD_YuanPlusAWD_V2.pdf`,
    sourceTitle: 'BYD Brasil — ficha técnica Yuan Plus AWD, revisão de julho de 2026',
    modelYearSourceUrl: bydLaunch,
    sourceUrls: ['https://www.byd.com/br/car/yuan-plus', bydLaunch],
  },
  ex30: {
    name: 'Volvo EX30 Core Single Motor MY2025',
    capacity: 49, capacityBasis: 'usable', rangeKm: 250,
    dcKw: 134, acKw: 11, modelYear: 2025, connector: 'CCS2', checkedAt,
    sourceUrl: volvoSheet,
    sourceTitle: 'Volvo — EX30 Price and Specification, Model Year 2025 / 25.5',
    rangeSourceUrl: volvoRange,
    modelYearSourceUrl: volvoSheet,
    sourceUrls: [volvoRange, volvoPort],
  },
  'ex30-er': {
    name: 'Volvo EX30 Plus Single Motor Extended Range MY2025',
    capacity: 65, capacityBasis: 'usable', rangeKm: 338,
    dcKw: 153, acKw: 11, modelYear: 2025, connector: 'CCS2', checkedAt,
    sourceUrl: volvoSheet,
    sourceTitle: 'Volvo — EX30 Price and Specification, Model Year 2025 / 25.5',
    rangeSourceUrl: volvoRange,
    modelYearSourceUrl: volvoSheet,
    sourceUrls: [volvoRange, volvoPort],
  },
  'ora-03-skin48': {
    name: 'GWM ORA 03 Skin BEV48 2026',
    capacity: 48, capacityBasis: 'nominal', rangeKm: 232,
    dcKw: 64, acKw: 11, modelYear: 2026, connector: 'CCS2', checkedAt,
    sourceUrl: 'https://www.gwmmotors.com.br/content/dam/gwm/pages/br/pt/media-center/modelos/ora-03-skin-bev48/ficha-tecnica-ora-o3-bev48-25-26.pdf',
    sourceTitle: 'GWM Brasil — ficha técnica ORA 03 Skin BEV48, ano/modelo 2025/2026',
    sourceUrls: ['https://www.gwmmotors.com.br/pt/media-center/news/2025/gwm-brasil-apresenta-linha-2026-do-ora-03-com-nova-identidade-visual-e-mais-tecnologia'],
  },
  'ora-03-gt63': {
    name: 'GWM ORA 03 GT BEV63 2026',
    capacity: 63, capacityBasis: 'nominal', rangeKm: 295,
    dcKw: 67, acKw: 11, modelYear: 2026, connector: 'CCS2', checkedAt,
    sourceUrl: 'https://www.gwmmotors.com.br/content/dam/gwm/pages/br/pt/models/ora-03-gt-bev63/FichaTecnica_Ora_03_GT_2025_2026_01_07_25.pdf',
    sourceTitle: 'GWM Brasil — ficha técnica ORA 03 GT BEV63, ano/modelo 2025/2026',
    sourceUrls: ['https://www.gwmmotors.com.br/pt/media-center/news/2025/gwm-brasil-apresenta-linha-2026-do-ora-03-com-nova-identidade-visual-e-mais-tecnologia'],
  },
  'ora-03-bev58': {
    name: 'GWM ORA 03 BEV58 2027',
    capacity: 58, capacityBasis: 'nominal', rangeKm: 315,
    dcKw: 64, acKw: 11, modelYear: 2027, connector: 'CCS2', checkedAt,
    sourceUrl: 'https://www.gwmmotors.com.br/content/dam/gwm/pages/br/pt/models/ora-03-bev58/ficha-tecnica/gwm-ora-03-bev58-ficha-tecnica.pdf',
    sourceTitle: 'GWM Brasil — ficha técnica ORA 03 BEV58, ano/modelo 2026/2027; simulador oficial de recarga',
    sourceUrls: ['https://www.gwmmotors.com.br/pt/experience/simulador-recarga', 'https://www.gwmmotors.com.br/pt/modelos/ora-03-bev58'],
  },
  'geely-ex2-pro': {
    name: 'Geely EX2 Pro 2026',
    capacity: 39.4, capacityBasis: 'nominal', rangeKm: 289,
    dcKw: 70, acKw: 6.6, modelYear: 2026, connector: 'CCS2', checkedAt,
    sourceUrl: geelyEx2Sheet,
    sourceTitle: 'Geely Brasil — ficha técnica EX2 Pro e Max',
    modelYearSourceUrl: 'https://www.geelybrasil.com.br/inter-geely/modelos/ex2-2026',
    sourceUrls: ['https://www.geelybrasil.com.br/ex2', 'https://static.autoforce.com/plugins/files/clientes/geely-brasil/produtos/ws/GEELY%20EX2_Manual_do_Propriet%C3%A1rio_2025.pdf'],
  },
  'geely-ex2-max': {
    name: 'Geely EX2 Max 2026',
    capacity: 39.4, capacityBasis: 'nominal', rangeKm: 289,
    dcKw: 70, acKw: 6.6, modelYear: 2026, connector: 'CCS2', checkedAt,
    sourceUrl: geelyEx2Sheet,
    sourceTitle: 'Geely Brasil — ficha técnica EX2 Pro e Max',
    modelYearSourceUrl: 'https://www.geelybrasil.com.br/inter-geely/modelos/ex2-2026',
    sourceUrls: ['https://www.geelybrasil.com.br/ex2', 'https://static.autoforce.com/plugins/files/clientes/geely-brasil/produtos/ws/GEELY%20EX2_Manual_do_Propriet%C3%A1rio_2025.pdf'],
  },
  'geely-ex5-pro': {
    name: 'Geely EX5 Pro 2026',
    capacity: 60.22, capacityBasis: 'nominal', rangeKm: 413,
    dcKw: 100, acKw: 11, modelYear: 2026, connector: 'CCS2', checkedAt,
    sourceUrl: geelyEx5Sheet,
    sourceTitle: 'Geely Brasil — ficha técnica EX5 Pro e Max',
    modelYearSourceUrl: 'https://www.geelybrasil.com.br/inter-geely/modelos/ex5-2026-4527',
    sourceUrls: ['https://www.geelybrasil.com.br/ex5', 'https://www.geelybrasil.com.br/geely-ex5-tecnologia-design-e-inteligencia', 'https://static.autoforce.com/plugins/files/clientes/geely-brasil/produtos/ws/GEELY_EX5_Manual_Proprietario_compressed.pdf'],
  },
  'geely-ex5-max': {
    name: 'Geely EX5 Max 2026',
    capacity: 60.22, capacityBasis: 'nominal', rangeKm: 349,
    dcKw: 100, acKw: 11, modelYear: 2026, connector: 'CCS2', checkedAt,
    sourceUrl: geelyEx5Sheet,
    sourceTitle: 'Geely Brasil — ficha técnica EX5 Pro e Max',
    modelYearSourceUrl: 'https://www.geelybrasil.com.br/inter-geely/modelos/ex5-2026-4527',
    sourceUrls: ['https://www.geelybrasil.com.br/ex5', 'https://www.geelybrasil.com.br/geely-ex5-tecnologia-design-e-inteligencia', 'https://static.autoforce.com/plugins/files/clientes/geely-brasil/produtos/ws/GEELY_EX5_Manual_Proprietario_compressed.pdf'],
  },
  'spark-euv': {
    name: 'Chevrolet Spark EUV Activ 2026',
    capacity: 42, capacityBasis: 'nominal', rangeKm: 258,
    dcKw: 50, acKw: 6.6, modelYear: 2026, connector: 'CCS2', checkedAt,
    sourceUrl: 'https://news.chevrolet.com.br/newsroom.detail.html/Pages/news/br/pt/2025/sep/0908-Chevrolet-Spark-EUV-estreia-como-primeiro-SUV-eletrico-acessivel-inteligente-Brasil.html',
    sourceTitle: 'Chevrolet Brasil — lançamento e especificações Spark EUV, 8 de setembro de 2025',
    modelYearSourceUrl: 'https://www.chevrolet.com.br/content/dam/chevrolet/south-america/brazil/portuguese/index/visid/electric/spark-euv/refresh/manuais/manual-do-propietario-spark-2026.pdf',
    sourceUrls: ['https://www.chevrolet.com.br/eletrico/spark-euv', 'https://news.chevrolet.com.ar/newsroom.detail.html/Pages/news/ar/es/2025/mar/2507-nota4.html'],
  },
};
