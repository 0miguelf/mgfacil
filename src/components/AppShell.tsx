import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import logoMarkUrl from "@/assets/logo-mark.png";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/40 bg-white/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/60 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-white/90"
            aria-label="Voltar ao início"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Início</span>
          </Link>
          <Link to="/" className="shrink-0" aria-label="MGFácil — página inicial">
            <img src={logoMarkUrl} alt="" width={36} height={36} className="h-9 w-9" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
          <div
            className="hidden items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-emerald-900 sm:inline-flex"
            title="Todo o processamento é feito localmente no seu navegador."
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Processamento local
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      <PrivacyFooter />
    </div>
  );
}

export function PrivacyBanner() {
  return (
    <div className="glass flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-foreground/80">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <p>
        Os ficheiros são processados <strong>localmente no seu navegador</strong> e não são
        armazenados nem enviados para servidores. Os metadados sensíveis (EXIF, GPS) são removidos
        automaticamente das imagens exportadas.
      </p>
    </div>
  );
}

function PrivacyFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="glass mx-auto max-w-xl rounded-2xl px-5 py-4 text-center text-xs text-foreground/80">
        MGFácil · Todo o processamento é local. Nenhum ficheiro sai do seu dispositivo.
      </div>
    </footer>
  );
}
