# Eletricities

Planejador de viagens de carro elétrico no Brasil, com mapa de rotas, estações de recarga e tarifas cadastradas.

## Executar localmente

Requer Python 3. Na raiz deste repositório, execute

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Abra [http://127.0.0.1:8000](http://127.0.0.1:8000) no navegador.

A aplicação usa HTML, CSS e JavaScript e pode ser hospedada como um site estático a partir de `dist`. As consultas de mapas e rotas precisam de acesso à internet.

## Dados

- Rotas calculadas pelo serviço OSRM do FOSSGIS e mapa-base do OpenStreetMap.
- Estações consultadas no OpenStreetMap, com um catálogo complementar de 721 pontos públicos brasileiros dos colaboradores do Open Charge Map, exportado em abril de 2026.
- Cada estação tem um link para seu cadastro de origem. As tarifas aparecem quando informadas na fonte. A disponibilidade em tempo real e a tarifa vigente dependem da operadora.
- Os cálculos usam as especificações publicadas dos veículos. O tempo exibido é um mínimo teórico baseado na energia necessária e na potência nominal. O custo estimado depende da tarifa por kWh cadastrada.

O catálogo complementar foi normalizado a partir do [export oficial do Open Charge Map](https://github.com/openchargemap/ocm-export/tree/8e3bedca48ca94807d96b2f5e7ee02cffe63ae54/data/BR). Esses registros são dos colaboradores do Open Charge Map e estão licenciados sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Consulte os [termos do Open Charge Map](https://www.openchargemap.org/about/terms) e a [atribuição do OpenStreetMap](https://www.openstreetmap.org/copyright).

A imagem de capa foi gerada com ImageGen para este projeto.
