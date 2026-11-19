# Notas para desenvolvimento

## Privacidade
- Todo o processamento de ficheiros é local, no navegador. Não acrescentar pedidos de rede,
  analytics ou bibliotecas que carreguem código de CDNs.

## Remover informações de PDFs
- Só as páginas com zonas marcadas são rasterizadas: os píxeis das zonas são limpos ANTES de a
  página ser codificada como PNG sem perdas, para não ficar texto nem imagem por baixo. Nunca
  sobrepor retângulos ao conteúdo original.
- As páginas sem zonas são copiadas sem alterações para um documento novo (sem metadados,
  anexos ou dados de formulários do original).
- As zonas guardam-se em coordenadas normalizadas da página apresentada (rodada/recortada);
  pré-visualização e exportação usam o mesmo espaço de coordenadas.
- Cada zona tem o seu âmbito de páginas; com vários documentos, páginas inexistentes num
  documento são ignoradas nesse documento.
- Manter os separadores das ferramentas PDF montados quando inativos, para não perder
  ficheiros e seleções.
