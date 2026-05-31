import type { Metadata } from "next"
import Link from "next/link"
import { ArticleShell } from "@/components/content/ArticleShell"
import { AffiliateCard } from "@/components/content/AffiliateCard"
import type { FaqItem } from "@/components/content/Faq"

export const metadata: Metadata = {
  title: "Finanças pessoais para iniciantes: por onde começar",
  description:
    "Guia prático de finanças pessoais para iniciantes: organizar gastos, montar reserva, sair das dívidas e começar a investir, passo a passo.",
  alternates: { canonical: "/guias/financas-pessoais-para-iniciantes" },
  openGraph: {
    title: "Finanças pessoais para iniciantes",
    description: "Por onde começar a organizar o seu dinheiro.",
    locale: "pt_BR",
    type: "article",
  },
}

const FAQ: FaqItem[] = [
  {
    q: "Por onde começar a organizar as finanças?",
    a: "Comece anotando tudo que entra e tudo que sai por um mês. Sem enxergar para onde o dinheiro vai, qualquer plano é chute. Depois, classifique os gastos e veja onde dá para cortar.",
  },
  {
    q: "Preciso ganhar muito para cuidar das finanças?",
    a: "Não. Organização não depende do tamanho da renda — depende de saber para onde o dinheiro vai. Quem ganha pouco e se organiza costuma estar à frente de quem ganha muito e não controla.",
  },
  {
    q: "Devo quitar dívidas ou montar reserva primeiro?",
    a: "Dívidas caras (cartão de crédito, cheque especial) vêm primeiro: os juros corroem qualquer rendimento. Mantenha uma reserva mínima de segurança e direcione o resto para quitar as dívidas mais caras.",
  },
]

export default function FinancasIniciantesPage() {
  return (
    <ArticleShell
      title="Finanças pessoais para iniciantes"
      lead="Organizar o dinheiro não exige planilhas complicadas nem ganhar muito. Exige um método simples e constância. Veja o passo a passo para começar hoje."
      faq={FAQ}
    >
      <h2>1. Saiba para onde vai o seu dinheiro</h2>
      <p>
        O primeiro passo é o mais importante e o mais ignorado: <strong>registrar entradas e
        gastos</strong>. Por um mês, anote tudo. A maioria das pessoas se surpreende com quanto gasta
        em coisas pequenas e recorrentes.
      </p>

      <h2>2. Separe gastos fixos e variáveis</h2>
      <p>
        Gastos <strong>fixos</strong> (aluguel, contas, assinaturas) são previsíveis; os{" "}
        <strong>variáveis</strong> (lazer, delivery, compras) são onde mora a maior parte do desperdício.
        Saber a diferença mostra onde você tem mais controle para ajustar.
      </p>

      <h2>3. Defina uma divisão para a renda</h2>
      <p>
        Um ponto de partida famoso é a{" "}
        <Link href="/calculadoras/regra-50-30-20">regra 50/30/20</Link>: 50% para necessidades, 30%
        para desejos e 20% para poupança. Não precisa ser exato — serve como direção.
      </p>

      <h2>4. Monte sua reserva de emergência</h2>
      <p>
        Antes de investir, garanta um colchão para imprevistos. Calcule{" "}
        <Link href="/calculadoras/reserva-de-emergencia">quanto você precisa de reserva</Link> e onde
        guardar esse dinheiro com segurança.
      </p>

      <h2>5. Crie metas com prazo</h2>
      <p>
        Objetivos vagos não saem do papel. Transforme &quot;quero viajar&quot; em &quot;R$ 6.000 em 12
        meses&quot;. Aí fica fácil ver{" "}
        <Link href="/calculadoras/quanto-guardar-por-mes">quanto guardar por mês</Link> para chegar lá.
      </p>

      <h2>6. Repita todo mês</h2>
      <p>
        Finanças pessoais não são um projeto com fim — são um hábito. Reserve 15 minutos no fim de cada
        mês para revisar o que entrou, o que saiu e o que sobrou. Com o tempo, isso vira automático.
      </p>

      <AffiliateCard
        slot="iniciantesCourse"
        intro="Quer se aprofundar com um material estruturado para iniciantes?"
      />
    </ArticleShell>
  )
}
