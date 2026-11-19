import { createFileRoute, Link } from "@tanstack/react-router";
import { ImageIcon, FileText, ArrowRight, ShieldCheck, UserX, Zap } from "lucide-react";

import { Clock } from "@/components/Clock";
import logoUrl from "@/assets/logo-mgfacil.png";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "MGFácil — Ferramentas para o dia-a-dia médico" },
    { name: "description", content: "Conversão de imagens e ferramentas PDF para o dia-a-dia médico, com processamento local no dispositivo." },
    { property: "og:title", content: "MGFácil — Ferramentas para o dia-a-dia médico" },
    { property: "og:description", content: "Conversão de imagens e ferramentas PDF para o dia-a-dia médico, com processamento local no dispositivo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Home,
});

const tools = [
  {
    to: "/image-converter" as const,
    icon: ImageIcon,
    name: "Conversor de imagens para JPG",
    description:
      "Converta PNG, WebP, HEIC/HEIF, TIFF, BMP e outros formatos para JPG, com versão original e versão reduzida.",
    accent: "from-sky-400/40 to-blue-500/40",
    iconBg: "bg-blue-500/15 text-blue-600",
  },
  {
    to: "/pdf-tools" as const,
    icon: FileText,
    name: "Ferramentas de PDF",
    description:
      "Juntar, dividir, reorganizar, remover, rodar páginas e comprimir PDFs, com miniaturas e drag-and-drop.",
    accent: "from-emerald-300/40 to-teal-500/40",
    iconBg: "bg-emerald-500/15 text-emerald-700",
  },
];

const highlights = [
  { icon: ShieldCheck, label: "Ficheiros nunca saem do dispositivo" },
  { icon: UserX, label: "Sem registo" },
  { icon: Zap, label: "Sem instalação" },
];

function Home() {
  return (
    <div className="min-h-dvh">
      <div className="pointer-events-none fixed top-4 right-4 z-40 sm:top-6 sm:right-6">
        <div className="pointer-events-auto">
          <Clock />
        </div>
      </div>
      <section className="mx-auto max-w-6xl px-4 pt-24 pb-8 sm:px-6 sm:pt-32">
        <div className="glass mb-8 flex flex-col gap-5 rounded-3xl px-6 py-6 sm:mb-12 sm:flex-row sm:items-center sm:gap-8 sm:px-8 sm:py-7">
          <h1 className="shrink-0">
            <img
              src={logoUrl}
              alt="MGFácil"
              width={800}
              height={721}
              className="h-24 w-auto sm:h-32"
            />
          </h1>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Ferramentas rápidas para o dia-a-dia clínico
            </p>
            <p className="mt-2 text-base text-foreground/75 sm:text-lg">
              Converta imagens e trate PDFs em segundos, diretamente no navegador.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2 text-xs font-medium sm:text-sm">
              {highlights.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-foreground/80"
                >
                  <Icon className="h-3.5 w-3.5 text-emerald-600" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.to}
                to={tool.to}
                className="group glass glass-hover relative overflow-hidden rounded-3xl p-6 sm:p-8"
              >
                <div
                  className={`pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br ${tool.accent} opacity-60 blur-3xl transition group-hover:opacity-90`}
                  aria-hidden="true"
                />
                <div className="relative">
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tool.iconBg}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-foreground sm:text-2xl">
                    {tool.name}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                    {tool.description}
                  </p>
                  <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    Abrir ferramenta
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="glass mt-10 rounded-2xl px-5 py-4 text-sm text-foreground/80">
          <p>
            <strong>Privacidade:</strong> os ficheiros são processados localmente no seu navegador
            e removidos da sessão ao atualizar ou fechar a página. Nenhum ficheiro é enviado para
            servidores. Os metadados EXIF/GPS são removidos por defeito nas imagens exportadas.
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="glass mx-auto max-w-md rounded-2xl px-5 py-4 text-center text-xs text-foreground/80">
          <p className="font-medium text-foreground">MGFácil</p>
          <p className="mt-2">
            © 2026{" "}
            <a
              href="https://www.linkedin.com/in/0miguelrferreira"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline"
            >
              Miguel R. Ferreira
            </a>
            . Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
