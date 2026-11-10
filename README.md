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

O HTML carrega o contêiner público `GTM-TR9GTJ45` com o snippet do Google Tag Manager no `head` e o fallback `noscript` no início do `body`. As tags e os destinos do Analytics são administrados na conta do Google Tag Manager.

Para verificar a instalação, use **Visualizar** no contêiner com `https://eletricities.com/` e confirme o disparo da tag no Tag Assistant. Após alterar as tags, use **Enviar → Publicar** no Tag Manager. Confira a coleta no relatório **Tempo real** da propriedade correta no Analytics.

Alterações no HTML precisam ser reconstruídas com `npm run build` e publicadas no Sites. O domínio público usa o Worker salvo no Sites; atualizar somente o repositório do GitHub não publica essa versão. Não instale outra chamada direta de `gtag.js` para a mesma propriedade em paralelo. O bootstrap não envia eventos personalizados com origem, destino ou outros campos do planejador.

Referências: [instalar o contêiner](https://support.google.com/tagmanager/answer/14847097?hl=pt-BR) e [configurar o Analytics no Tag Manager](https://support.google.com/tagmanager/answer/9442095?hl=pt-BR).

## Publicação com Worker

O site público fica no Sites, com o domínio `https://eletricities.com/`. Atualizar somente o GitHub não altera a versão publicada. Preserve o projeto de `.openai/hosting.json`, as variáveis de ambiente e o público ao salvar e publicar uma versão.

### Catálogos, conteúdo e SEO

- `dist/vehicles.mjs`: 18 versões com fichas oficiais, autonomia PBEV/Inmetro, potência AC/DC, ano quando confirmado e distinção entre bateria útil e nominal. Conferência em 09/11/2026.
- `dist/published-tariffs.mjs`: preços aplicáveis aos pontos e conectores identificados nas publicações.
- `dist/tariff-estimates.mjs`: seis referências de energia da Volvo, Celesc e dois pontos Kinsol; médias separadas por AC/DC. Quando falta preço aplicável, procura três estações da mesma operadora/tipo, depois cinco da mesma região/tipo, depois as referências publicadas. Mostra amostra, faixa, fontes e datas, sem estimar taxas adicionais nem substituir preços zero ou cobranças incompatíveis por sessão/tempo.
- `scripts/build-content.mjs`: gera HTML inicial com fontes para `/precos-recarga/`, `/carros-eletricos/` e `/sobre-os-dados/`, além de sitemap, robots e dados estruturados descritivos. Não há avaliações ou estrelas inventadas.

O build recria os guias e o resumo da home a partir dos mesmos catálogos usados no planejador. Atualize `modifiedAt` no gerador somente quando o conteúdo mudar. Para acompanhar rastreamento e indexação, envie `https://eletricities.com/sitemap.xml` ao Google Search Console. A instalação do Analytics não envia o sitemap por si só.

A interface usa fontes do sistema, carrega o catálogo complementar somente após a consulta e adia os tiles do mapa até serem necessários. Os cartões são exibidos em grupos de 24; todos os pontos permanecem no mapa. As amostras e o corredor da rota são reaproveitados quando apenas o veículo ou a bateria mudam. O Worker oferece ETags, respostas 304 e redirecionamentos para as URLs canônicas dos guias.

Os limites publicados de potência não descrevem a curva completa da sessão. O tempo continua sendo um mínimo teórico e a capacidade nominal não equivale a energia integral utilizável.

`npm run build` gera `dist/server/index.js`, um Worker ES module com os arquivos públicos incorporados e a mesma API do servidor Node. Não há dependências para instalar. O código compartilhado das consultas fica em `lib/charging-api.mjs` e o adaptador em `worker/index.mjs`.

Configure `OPEN_CHARGE_MAP_API_KEY` como segredo no ambiente de execução da hospedagem. A chave não participa do build nem é enviada ao navegador. O Worker atende HTTPS pela hospedagem e não usa a variável `PORT`; o servidor Node continua usando `PORT=8766`.

O build preserva os arquivos originais de `dist` e gera também `dist/.openai/hosting.json` para o empacotamento. Os arquivos gerados não são versionados. O domínio `eletricities.com` pode ser conectado na hospedagem e seus registros DNS gerenciados na Hostinger.

## Publicação com Node.js em uma VPS

É necessário um servidor que execute Node.js ou Docker; enviar apenas `dist` para uma hospedagem estática não disponibiliza a API. O exemplo abaixo usa uma VPS com Docker Compose e Nginx já instalados.

1. No servidor, clone este repositório e crie `.env` a partir de `.env.example`. Preencha a chave do Open Charge Map e proteja o arquivo com `chmod 600 .env`.
2. Execute `docker compose up -d --build`. O aplicativo ficará acessível apenas em `127.0.0.1:8766` na VPS, com reinício automático. A chave entra como variável de ambiente e não é copiada para a imagem.
3. Aponte os registros DNS `A` de `@` e `www` para o IP público da VPS. Remova registros `AAAA` conflitantes caso a VPS não atenda pelo IPv6 anunciado.
4. Crie `/etc/nginx/sites-available/eletricities.com` com a configuração abaixo e habilite-a em `sites-enabled`. Verifique `nginx -t` antes de recarregar o Nginx.

```nginx
server {
    listen 80;
    server_name eletricities.com www.eletricities.com;

    location / {
        proxy_pass http://127.0.0.1:8766;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

5. Com o DNS apontando para a VPS e as portas 80/443 disponíveis, emita o HTTPS com `certbot --nginx -d eletricities.com -d www.eletricities.com`.
6. Verifique `https://eletricities.com/api/data-sources`: `openChargeMap.configured` deve ser `true`. Confirme também o planejamento de uma rota no site.

O Compose configura `ALLOWED_HOSTS=eletricities.com,www.eletricities.com`. Fora do Docker, use essa variável para permitir os domínios de produção e `HOST` para escolher a interface de escuta. Por padrão, o servidor escuta em `127.0.0.1` e aceita somente hosts locais. A lista adicional aceita apenas nomes exatos separados por vírgula, sem protocolo, caminho, porta ou curinga; hosts locais continuam permitidos para verificações internas. Para atualizar, execute `git pull --ff-only` e `docker compose up -d --build`.

## Dados

- Rotas calculadas com OSRM, usando o serviço do FOSSGIS e o servidor oficial do projeto como alternativa em caso de falha. Mapa-base do OpenStreetMap.
- Estações consultadas nas APIs do OpenStreetMap e do Open Charge Map, com um catálogo complementar de 721 pontos públicos brasileiros dos colaboradores do Open Charge Map, exportado em abril de 2026. O acesso à API do Open Charge Map usa sua chave gratuita.
- Cada estação tem um link para seu cadastro de origem. As tarifas aparecem quando informadas na fonte. A disponibilidade em tempo real e a tarifa vigente dependem da operadora.
- Os cálculos usam as especificações publicadas dos veículos. O tempo exibido é um mínimo teórico baseado na energia necessária e na potência nominal. O custo estimado depende da tarifa por kWh cadastrada.

O catálogo complementar foi normalizado a partir do [export oficial do Open Charge Map](https://github.com/openchargemap/ocm-export/tree/8e3bedca48ca94807d96b2f5e7ee02cffe63ae54/data/BR). Esses registros são dos colaboradores do Open Charge Map e estão licenciados sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Consulte os [termos do Open Charge Map](https://www.openchargemap.org/about/terms) e a [atribuição do OpenStreetMap](https://www.openstreetmap.org/copyright).

A imagem de capa foi gerada com ImageGen para este projeto.
