# Notas para desenvolvimento

## Privacidade
- Todo o processamento de ficheiros é local, no navegador. Não acrescentar pedidos de rede,
  analytics ou bibliotecas que carreguem código de CDNs.
- A Content-Security-Policy gerada por `scripts/csp.mjs` faz parte desta garantia. Não a
  alargar (`'unsafe-eval'`, `'unsafe-inline'` em `script-src`, outros domínios em
  `connect-src`); escolher bibliotecas que funcionem com ela (ex.: `heic-to/csp`).

## Remover informações de PDFs
- Só as páginas com zonas marcadas são rasterizadas: os píxeis das zonas são limpos ANTES de a
  página ser codificada como PNG sem perdas, para não ficar texto nem imagem por baixo. Nunca
  sobrepor retângulos ao conteúdo original.
- As páginas sem zonas são copiadas para um documento novo (sem metadados, anexos ou dados
  de formulários do original). As anotações visíveis dessas páginas (campos preenchidos,
  carimbos, marcações) são desenhadas no conteúdo da página e depois todas as anotações e
  ações são removidas (`src/lib/pdf/flatten.ts`), para não levar comentários escondidos,
  links nem scripts. No fim, os objetos que deixaram de estar ligados ao documento são
  apagados do ficheiro.
- As zonas guardam-se em coordenadas normalizadas da página apresentada (rodada/recortada);
  pré-visualização e exportação usam o mesmo espaço de coordenadas.
- Cada zona tem o seu âmbito de páginas; com vários documentos, páginas inexistentes num
  documento são ignoradas nesse documento.
- Manter os separadores das ferramentas PDF montados quando inativos, para não perder
  ficheiros e seleções.
