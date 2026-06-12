import type { Metadata } from "next"
import { ContentShell } from "@/components/ContentShell"

export const metadata: Metadata = {
  title: "Política de Privacidade — Gestor Financeiro",
  description:
    "Como o Gestor Financeiro trata seus dados: armazenamento local no navegador, cookies de medição e anúncios, e seus direitos sob a LGPD.",
  alternates: { canonical: "/privacidade" },
}

export default function PrivacidadePage() {
  return (
    <ContentShell title="Política de Privacidade" subtitle="Última atualização: maio de 2026">
      <p>
        Esta política explica como o <strong>Gestor Financeiro</strong> trata informações ao usar
        nosso site e aplicativo. Levamos sua privacidade a sério e seguimos a Lei Geral de Proteção
        de Dados (LGPD — Lei nº 13.709/2018).
      </p>

      <h2>1. Dados financeiros ficam no seu navegador</h2>
      <p>
        Os valores que você registra (entradas, gastos e metas) são salvos{" "}
        <strong>exclusivamente no armazenamento local do seu navegador</strong> (localStorage). Esses
        dados não são enviados para nossos servidores, não saem do seu dispositivo e não conseguimos
        acessá-los. Se você limpar os dados do navegador, eles serão perdidos — por isso oferecemos a
        função de exportar um backup em arquivo.
      </p>

      <h2>2. Dados que podemos coletar</h2>
      <ul>
        <li>
          <strong>Medição de uso (analytics):</strong> podemos usar ferramentas para entender de
          forma agregada e anônima como o site é utilizado (páginas visitadas, dispositivo,
          origem do acesso).
        </li>
        <li>
          <strong>Anúncios:</strong> futuramente poderemos exibir anúncios (por exemplo, Google
          AdSense). Parceiros de publicidade podem usar cookies para exibir anúncios mais
          relevantes.
        </li>
      </ul>

      <h2>3. Cookies e consentimento</h2>
      <p>
        Exibimos um aviso de consentimento na primeira visita. Você pode aceitar ou recusar o uso de
        cookies de medição e publicidade. Cookies estritamente necessários ao funcionamento do site
        podem ser usados independentemente da sua escolha.
      </p>

      <h2>4. Google AdSense</h2>
      <p>
        Caso anúncios estejam ativos, o Google e seus parceiros podem usar cookies para personalizar
        anúncios com base em visitas anteriores a este e a outros sites. Você pode gerenciar suas
        preferências nas{" "}
        <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">
          Configurações de anúncios do Google
        </a>
        .
      </p>

      <h2>5. Seus direitos (LGPD)</h2>
      <p>
        Você tem direito a acesso, correção, exclusão e portabilidade dos seus dados. Como seus dados
        financeiros ficam apenas no seu navegador, você pode exercê-los diretamente: exportando ou
        apagando os dados a qualquer momento.
      </p>

      <h2>6. Contato</h2>
      <p>
        Dúvidas sobre esta política podem ser enviadas pelo canal de contato divulgado no site.
      </p>
    </ContentShell>
  )
}
