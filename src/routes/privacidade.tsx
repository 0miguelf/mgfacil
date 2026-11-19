import { createFileRoute, Link } from "@tanstack/react-router";

import { ContactLink, LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — MGFácil" },
      {
        name: "description",
        content:
          "Como o MGFácil trata os seus dados: os ficheiros são processados apenas no seu dispositivo e nunca são enviados para servidores.",
      },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Política de Privacidade">
      <section>
        <h2>Resumo</h2>
        <ul>
          <li>
            Os ficheiros que abre no {SITE.name} (imagens e PDFs) são processados{" "}
            <strong>apenas no seu dispositivo</strong>, pelo seu navegador. Nunca são enviados para
            nenhum servidor, nem para o nosso, nem para terceiros.
          </li>
          <li>Não há contas, registo, cookies, publicidade nem estatísticas de utilização.</li>
          <li>
            Como qualquer site, o serviço de alojamento regista dados técnicos dos acessos (por
            exemplo, o endereço IP) para entregar as páginas e proteger o site.
          </li>
        </ul>
      </section>

      <section>
        <h2>1. Responsável pelo tratamento</h2>
        <p>
          O {SITE.name} ({SITE.domain}) é mantido por {SITE.owner}, a título individual. Para
          qualquer questão sobre privacidade ou para exercer os seus direitos, contacte:{" "}
          <ContactLink />.
        </p>
      </section>

      <section>
        <h2>2. Ficheiros que processa</h2>
        <p>
          Todas as ferramentas (conversão de imagens e ferramentas de PDF) funcionam inteiramente no
          seu navegador. Os ficheiros são lidos para a memória do seu dispositivo, processados aí e
          os resultados são guardados diretamente no seu dispositivo quando os descarrega.
        </p>
        <ul>
          <li>
            Não recebemos, não vemos e não guardamos os seus ficheiros nem o seu conteúdo. Por isso,
            não tratamos os dados pessoais ou de saúde que possam conter.
          </li>
          <li>
            Os ficheiros desaparecem da memória quando atualiza ou fecha a página, ou quando os
            remove da ferramenta.
          </li>
          <li>
            Esta garantia é também técnica: o site define uma política de segurança de conteúdo
            (Content Security Policy) que instrui o navegador a recusar qualquer envio de dados para
            outros servidores.
          </li>
        </ul>
        <p>
          Como os ficheiros nunca saem do seu dispositivo, continua a ser o responsável pelos dados
          que contêm, nos termos da lei e das regras de sigilo a que esteja sujeito.
        </p>
      </section>

      <section>
        <h2>3. Dados técnicos de acesso</h2>
        <p>
          O site é alojado no {SITE.hosting.service}, um serviço da {SITE.hosting.name}. Quando
          visita o site, o seu navegador pede as páginas a esse serviço, que trata, de forma
          automática, dados técnicos como o endereço IP, a data e hora, a página pedida e o tipo de
          navegador e de dispositivo.
        </p>
        <ul>
          <li>
            <strong>Finalidade:</strong> entregar as páginas, garantir o funcionamento e proteger o
            site contra abusos e ataques.
          </li>
          <li>
            <strong>Fundamento:</strong> interesse legítimo em disponibilizar um site seguro e
            funcional (artigo 6.º, n.º 1, alínea f), do Regulamento Geral sobre a Proteção de Dados,
            RGPD).
          </li>
          <li>
            <strong>Conservação:</strong> estes registos são mantidos pela {SITE.hosting.name} pelos
            prazos definidos na sua{" "}
            <a href={SITE.hosting.privacyUrl} target="_blank" rel="noopener noreferrer">
              política de privacidade
            </a>
            . O responsável pelo site não guarda registos de acessos e apenas pode consultar
            estatísticas agregadas de tráfego fornecidas pelo alojamento.
          </li>
          <li>
            <strong>Transferências internacionais:</strong> a {SITE.hosting.name} tem sede nos
            Estados Unidos e opera uma rede mundial, pelo que estes dados técnicos podem ser
            tratados fora do Espaço Económico Europeu. A {SITE.hosting.name} declara aderir ao
            EU-U.S. Data Privacy Framework, reconhecido pela Comissão Europeia como garantindo um
            nível de proteção adequado, e utiliza as cláusulas contratuais-tipo aprovadas pela
            Comissão.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Cookies e armazenamento no navegador</h2>
        <p>
          O {SITE.name} não usa cookies, nem próprios nem de terceiros, e não usa ferramentas de
          estatística, publicidade ou rastreamento.
        </p>
        <p>
          Para que, ao voltar a uma página, esta abra na mesma posição, o site guarda
          temporariamente a posição de deslocamento no armazenamento de sessão do navegador
          (sessionStorage). Esta informação fica apenas no seu dispositivo, nunca é enviada para
          servidores e é apagada quando fecha o separador.
        </p>
      </section>

      <section>
        <h2>5. Ligações externas</h2>
        <p>
          O site pode conter ligações para sites de terceiros (por exemplo, o LinkedIn do autor). Ao
          segui-las, passa a aplicar-se a política de privacidade desses sites.
        </p>
      </section>

      <section>
        <h2>6. Os seus direitos</h2>
        <p>
          Nos termos do RGPD, tem direito de acesso, retificação, apagamento, limitação e
          portabilidade dos seus dados, e de oposição ao seu tratamento. Como o {SITE.name} não
          recolhe dados pessoais além dos registos técnicos tratados pelo alojamento, em regra não
          teremos dados seus para disponibilizar; ainda assim, pode contactar-nos através de{" "}
          <ContactLink /> e responderemos no prazo previsto na lei.
        </p>
        <p>
          Tem também o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados
          (CNPD),{" "}
          <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">
            www.cnpd.pt
          </a>
          .
        </p>
      </section>

      <section>
        <h2>7. Alterações</h2>
        <p>
          Esta política pode ser atualizada, por exemplo, se o site mudar de alojamento ou ganhar
          novas funcionalidades. A data da última atualização está indicada no topo da página.
          Consulte também os <Link to="/termos">Termos de Utilização</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
