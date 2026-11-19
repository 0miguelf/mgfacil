import { createFileRoute } from "@tanstack/react-router";

import { NotFoundComponent } from "./__root";

// Pre-generated as /404.html, which static hosts serve for unknown addresses.
export const Route = createFileRoute("/404")({
  head: () => ({
    meta: [{ title: "Página não encontrada — MGFácil" }, { name: "robots", content: "noindex" }],
  }),
  component: NotFoundComponent,
});
