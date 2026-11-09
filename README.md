# Eletricities

Planejador de viagens de carro elétrico no Brasil, com mapa de rotas, estações de recarga e tarifas cadastradas.

## Executar localmente

Requer Node.js 22 ou mais recente. Na raiz deste repositório, execute

```sh
node --env-file-if-exists=.env server.mjs
```

Abra [http://127.0.0.1:8766](http://127.0.0.1:8766) no navegador.

A interface usa HTML, CSS e JavaScript. O servidor local entrega `dist` e consulta a API gratuita do Open Charge Map quando sua chave está configurada. As consultas de mapas, rotas e estações precisam de acesso à internet. A hospedagem com consultas ao Open Charge Map deve executar também o backend e configurar a variável de ambiente.

## Ativar a consulta gratuita ao Open Charge Map

1. Entre em [Open Charge Map](https://openchargemap.org/profile) e abra **My Profile → My Apps → Register An Application** para registrar o Eletricities e obter sua chave gratuita.
2. Copie `.env.example` para `.env` e preencha `OPEN_CHARGE_MAP_API_KEY` nesse arquivo local.
3. Inicie ou reinicie o servidor pelo comando acima.

O arquivo `.env` é ignorado pelo Git. A chave fica no servidor. O endpoint `/api/data-sources` informa se a consulta está configurada. Quando a chave ou o serviço está indisponível, o app identifica a limitação e usa as demais fontes abertas.

O Open Charge Map publica cadastros comunitários e dados abertos importados de operadores. O campo original de tarifa pode incluir taxa de ativação, cobrança por tempo e condições. A interface preserva esse texto. Atualização de cadastro e verificação de tarifa são informações diferentes.

As tarifas públicas conferidas nas operadoras ficam em `dist/published-tariffs.mjs`, com URL, data da conferência, vigência e identificadores exatos do local e do conector. A tabela da Volvo se aplica apenas aos pontos confirmados na lista publicada pela própria rede. Os preços do portal EVoltBR se aplicam aos conectores indicados, observados em 6 de novembro de 2026. São referências publicadas com data, que precisam de nova conferência quando a operadora altera suas condições.

O leitor de tarifas reconhece valores por kWh em textos, separa AC e DC e inclui taxas fixas explícitas no subtotal quando a regra é completa. A cobrança por ociosidade é exibida com suas condições. Textos ambíguos continuam visíveis para consulta.

## Google Analytics com Google Tag Manager

O HTML carrega o contêiner `GTM-TR9GTJ45` com o snippet do Google Tag Manager no `head` e o fallback `noscript` no início do `body`. O ID do contêiner é público. A instalação do contêiner no site não confirma que uma propriedade do Analytics está recebendo dados.

Para configurar o GA4 nesse contêiner:

1. No Google Analytics, abra **Administrador → Fluxos de dados**, selecione o fluxo da Web do Eletricities e copie o ID de medição, que começa com `G-`.
2. No [Google Tag Manager](https://tagmanager.google.com/), abra `GTM-TR9GTJ45`. Se ainda não houver uma tag conectada à propriedade correta, crie **Tags → Nova → Tag do Google** e informe esse ID.
3. Use o acionador **Initialization – All Pages** (Inicialização – Todas as páginas) e salve.
4. Use **Visualizar** para testar o endereço do site com o Tag Assistant. Depois, clique em **Enviar → Publicar** para publicar o contêiner.
5. Acesse o site e confira o relatório **Tempo real** da propriedade no Analytics. A versão atualizada do HTML também precisa estar na hospedagem para medir os visitantes desse endereço.

Não instale outra chamada direta de `gtag.js` para a mesma propriedade em paralelo. Este código não envia eventos personalizados com origem, destino ou outros campos do planejador. A configuração das tags permanece na conta do Google Tag Manager.

Referências: [instalar o contêiner](https://support.google.com/tagmanager/answer/14847097?hl=pt-BR) e [configurar o Analytics no Tag Manager](https://support.google.com/tagmanager/answer/9442095?hl=pt-BR).

## Dados

- Rotas calculadas com OSRM, usando o serviço do FOSSGIS e o servidor oficial do projeto como alternativa em caso de falha. Mapa-base do OpenStreetMap.
- Estações consultadas nas APIs do OpenStreetMap e do Open Charge Map, com um catálogo complementar de 721 pontos públicos brasileiros dos colaboradores do Open Charge Map, exportado em abril de 2026. O acesso à API do Open Charge Map usa sua chave gratuita.
- Cada estação tem um link para seu cadastro de origem. As tarifas aparecem quando informadas na fonte. A disponibilidade em tempo real e a tarifa vigente dependem da operadora.
- Os cálculos usam as especificações publicadas dos veículos. O tempo exibido é um mínimo teórico baseado na energia necessária e na potência nominal. O custo estimado depende da tarifa por kWh cadastrada.

O catálogo complementar foi normalizado a partir do [export oficial do Open Charge Map](https://github.com/openchargemap/ocm-export/tree/8e3bedca48ca94807d96b2f5e7ee02cffe63ae54/data/BR). Esses registros são dos colaboradores do Open Charge Map e estão licenciados sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Consulte os [termos do Open Charge Map](https://www.openchargemap.org/about/terms) e a [atribuição do OpenStreetMap](https://www.openstreetmap.org/copyright).

A imagem de capa foi gerada com ImageGen para este projeto.
