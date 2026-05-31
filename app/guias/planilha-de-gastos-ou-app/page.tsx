import type { Metadata } from "next"
import Link from "next/link"
import { ArticleShell } from "@/components/content/ArticleShell"
import type { FaqItem } from "@/components/content/Faq"

export const metadata: Metadata = {
  title: "Planilha de gastos ou app? Qual usar para controlar dinheiro",
  description:
    "Planilha de gastos x aplicativo: vantagens e desvantagens de cada um para controlar o orçamento. Veja qual faz mais sentido para você.",
  alternates: { canonical: "/guias/planilha-de-gastos-ou-app" },
  openGraph: {
    title: "Planilha de gastos ou app?",
    description: "Compare planilha e aplicativo para controlar seus gastos.",
    locale: "pt_BR",
    type: "article",
  },
}

const FAQ: FaqItem[] = [
  {
    q: "Planilha de gastos ainda vale a pena?",
    a: "Vale para quem gosta de personalizar fórmulas e tem disciplina para preencher. Para a maioria, porém, a planilha é abandonada em poucas semanas pela fricção de manter tudo manualmente.",
  },
  {
    q: "App de controle financeiro é seguro?",
    a: "Depende do app. Ferramentas que guardam os dados só no seu navegador (como esta) não enviam suas informações para servidores, o que reduz bastante a preocupação com privacidade.",
  },
  {
    q: "Preciso pagar por um app de finanças?",
    a: "Não necessariamente. Há boas opções gratuitas. O essencial é que a ferramenta seja simples o suficiente para você usar todo mês sem desistir.",
  },
]

export default function PlanilhaOuAppPage() {
  return (
    <ArticleShell
      title="Planilha de gastos ou app: qual usar?"
      lead="A planilha é flexível, mas dá trabalho. O app é prático, mas você abre mão de parte do controle. Veja os prós e contras e descubra o que combina com você."
      faq={FAQ}
      cta={{
        title: "Prefere algo simples e gratuito?",
        description: "Este app faz o controle por você, guarda tudo no seu navegador e não pede cadastro.",
        label: "Testar o app grátis",
      }}
    >
      <h2>A planilha de gastos</h2>
      <p>
        Planilhas (Excel, Google Sheets) são <strong>poderosas e personalizáveis</strong>. Você cria as
        categorias, as fórmulas e os gráficos que quiser. O problema raramente é a planilha — é a
        <strong> disciplina de mantê-la</strong>. Preencher célula por célula vira fricção, e a maioria
        abandona em poucas semanas.
      </p>
      <ul>
        <li><strong>A favor:</strong> grátis, flexível, offline, você é dono dos dados.</li>
        <li><strong>Contra:</strong> trabalhosa, fácil de errar fórmula, pouco prática no celular.</li>
      </ul>

      <h2>O aplicativo</h2>
      <p>
        Um bom app tira a fricção: os cálculos são automáticos, a visualização é pronta e funciona no
        celular. O cuidado fica com <strong>privacidade</strong> (para onde vão seus dados?) e com{" "}
        <strong>excesso de funções</strong> que tornam o app complicado.
      </p>
      <ul>
        <li><strong>A favor:</strong> rápido, cálculos automáticos, gráficos prontos, bom no celular.</li>
        <li><strong>Contra:</strong> alguns pedem cadastro e enviam seus dados para a nuvem.</li>
      </ul>

      <h2>O meio-termo ideal</h2>
      <p>
        O melhor dos dois mundos é um app <strong>simples</strong>, que faça os cálculos por você mas
        que mantenha seus dados <strong>no seu próprio navegador</strong> — sem cadastro e sem enviar
        nada para servidores. É exatamente assim que o{" "}
        <Link href="/">Gestor Financeiro</Link> funciona: você registra entradas e gastos, ele mostra
        quanto sobra e ajuda a distribuir entre suas metas.
      </p>
    </ArticleShell>
  )
}
