# MGFácil

Ferramentas simples e rápidas para o dia-a-dia clínico, com todo o processamento feito
localmente no navegador. Nenhum ficheiro é enviado para servidores.

## Ferramentas

- **Conversor de imagens para JPG** — PNG, WebP, HEIC/HEIF, TIFF, BMP e outros formatos,
  com versão original e versão reduzida para plataformas clínicas.
- **Ferramentas de PDF** — juntar, dividir, reorganizar, rodar e remover páginas,
  comprimir e remover informações (vários documentos de uma vez, zonas por página).

## Desenvolvimento

Requer [Node.js](https://nodejs.org) 22 ou mais recente.

```sh
npm install
npm run dev      # http://localhost:8080
npm run build    # site estático em dist/client
npm run lint
```

## Publicação

`npm run build` gera um site totalmente estático em `dist/client`, que pode ser alojado em
qualquer serviço de páginas estáticas (Cloudflare Pages, Netlify, GitHub Pages…).

- Comando de build: `npm run build`
- Pasta a publicar: `dist/client`

As páginas são pré-geradas em HTML; `404.html` é servido automaticamente para endereços
inexistentes.

### Segurança

O build acrescenta uma Content-Security-Policy estrita (`scripts/csp.mjs`): só são executados
os scripts do próprio site e os scripts inline do framework, autorizados pela sua hash, e
`connect-src 'self'` impede o navegador de enviar dados para qualquer outro servidor. A
política fica numa `<meta>` em cada página (funciona em qualquer alojamento) e em
`dist/client/_headers`, que o Cloudflare Pages e o Netlify enviam como cabeçalhos HTTP, com
proteção adicional contra a inclusão do site noutras páginas (`frame-ancestors`).

## Tecnologia

React, TanStack Router/Start, Tailwind CSS, PDF.js e pdf-lib.

---

© 2026 Miguel R. Ferreira. Todos os direitos reservados.
