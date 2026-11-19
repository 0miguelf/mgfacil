import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { Wallpaper } from "../components/Wallpaper";

export function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass max-w-md rounded-3xl p-10 text-center">
        <h1 className="text-6xl font-semibold tracking-tight text-foreground">404</h1>
        <h2 className="mt-3 text-lg font-medium text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass max-w-md rounded-3xl p-10 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Ocorreu um problema
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo correu mal. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset?.();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-white/60 px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/80"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MGFácil — Ferramentas rápidas" },
      {
        name: "description",
        content:
          "Ferramentas simples e rápidas para uso diário: conversão de imagens para JPG e edição de PDFs, tudo processado localmente no navegador.",
      },
      { name: "author", content: "MGFácil" },
      { property: "og:title", content: "MGFácil — Ferramentas rápidas" },
      {
        property: "og:description",
        content:
          "Ferramentas simples e rápidas para uso diário: conversão de imagens para JPG e edição de PDFs, tudo processado localmente no navegador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MGFácil — Ferramentas rápidas" },
      {
        name: "twitter:description",
        content:
          "Ferramentas simples e rápidas para uso diário: conversão de imagens para JPG e edição de PDFs, tudo processado localmente no navegador.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Wallpaper />
      <Outlet />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "oklch(1 0 0 / 0.85)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid oklch(1 0 0 / 0.6)",
            borderRadius: "14px",
          },
        }}
      />
    </QueryClientProvider>
  );
}
