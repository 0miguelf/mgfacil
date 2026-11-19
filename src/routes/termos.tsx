import { createFileRoute, Link } from "@tanstack/react-router";

import { ContactLink, LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Utilização — MGFácil" },
      {
        name: "description",
        content: "Condições de utilização das ferramentas gratuitas do MGFácil.",
      },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Termos de Utilização">
      <section>
        <h2>1. Identificação</h2>
        <p>
          O {SITE.name}, disponível em {SITE.domain}, é mantido por {SITE.owner}. Contacto:{" "}
          <ContactLink />.
        </p>
        <p>
          Ao utilizar o site, aceita estes Termos de Utilização. Se não concordar com eles, não
          utilize o site.
        </p>
      </section>

      <section>
        <h2>2. O serviço</h2>
        <p>
          O {SITE.name} disponibiliza, gratuitamente e sem registo, ferramentas para converter
          imagens e para manipular ficheiros PDF (juntar, dividir, reorganizar, rodar, comprimir e
          remover informações). Todo o processamento é feito no seu navegador; os ficheiros não são
          enviados para servidores, como descrito na{" "}
          <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
      </section>

      <section>
        <h2>3. Natureza das ferramentas</h2>
        <p>
          As ferramentas são utilitários genéricos de ficheiros. Não interpretam o conteúdo clínico
          dos documentos, não prestam cuidados ou aconselhamento de saúde e não se destinam a apoiar
          diagnósticos ou decisões clínicas. O {SITE.name} não é um dispositivo médico.
        </p>
      </section>

      <section>
        <h2>4. Responsabilidades do utilizador</h2>
        <ul>
          <li>
            Deve ter legitimidade para tratar os ficheiros que abre e cumprir as obrigações legais,
            deontológicas e de sigilo aplicáveis aos dados que contêm, incluindo o RGPD.
          </li>
          <li>
            Deve verificar os ficheiros produzidos antes de os usar ou partilhar e guardar uma cópia
            dos originais.
          </li>
          <li>
            A ferramenta <strong>Remover informações</strong> elimina apenas as zonas que marcar.
            Dados identificáveis fora dessas zonas continuam visíveis e pesquisáveis, e a ferramenta
            não garante a anonimização completa dos documentos. Confirmar o resultado é da
            responsabilidade de quem a utiliza.
          </li>
          <li>
            Não pode usar o site para fins ilícitos nem tentar perturbar o seu funcionamento ou a
            sua segurança.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Disponibilidade e garantias</h2>
        <p>
          O site é disponibilizado gratuitamente, tal como está e conforme disponível. Procuramos
          que funcione corretamente, mas não garantimos que esteja sempre disponível, isento de
          erros ou adequado a um fim específico. As funcionalidades podem ser alteradas, suspensas
          ou descontinuadas a qualquer momento.
        </p>
      </section>

      <section>
        <h2>6. Limitação de responsabilidade</h2>
        <p>
          Na medida máxima permitida por lei, o responsável pelo site não responde por danos
          resultantes da utilização ou da impossibilidade de utilização do site, incluindo a perda
          ou alteração de ficheiros ou a divulgação de informação que permaneça nos ficheiros
          produzidos. Esta limitação não se aplica aos casos de dolo ou culpa grave nem aos demais
          casos em que a lei não permita a exclusão ou limitação de responsabilidade.
        </p>
      </section>

      <section>
        <h2>7. Propriedade intelectual</h2>
        <p>
          O nome, o logótipo, o design e o código do {SITE.name} pertencem ao seu autor. Os
          ficheiros que processa continuam a ser seus: o site não adquire quaisquer direitos sobre
          eles.
        </p>
        <p>
          O site utiliza software de código aberto de terceiros, sujeito às respetivas licenças,
          incluindo PDF.js (Apache 2.0), pdf-lib (MIT), heic-to e libheif (LGPL 3.0), JSZip (MIT) e
          React (MIT).
        </p>
      </section>

      <section>
        <h2>8. Lei aplicável</h2>
        <p>
          Estes termos regem-se pela lei portuguesa. Para a resolução de litígios são competentes os
          tribunais portugueses, sem prejuízo das normas imperativas aplicáveis, nomeadamente as de
          proteção dos consumidores.
        </p>
      </section>

      <section>
        <h2>9. Alterações</h2>
        <p>
          Estes termos podem ser atualizados. A versão em vigor é a publicada nesta página, com a
          data da última atualização indicada no topo.
        </p>
      </section>
    </LegalPage>
  );
}
