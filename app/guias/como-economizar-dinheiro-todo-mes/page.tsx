import type { Metadata } from "next"
import Link from "next/link"
import { ArticleShell } from "@/components/content/ArticleShell"
import { AffiliateCard } from "@/components/content/AffiliateCard"
import type { FaqItem } from "@/components/content/Faq"

export const metadata: Metadata = {
  title: "Como economizar dinheiro todo mês: 8 estratégias práticas",
  description:
    "Estratégias práticas para economizar dinheiro todo mês: cortar gastos invisíveis, renegociar fixos, automatizar a poupança e mais.",
  alternates: { canonical: "/guias/como-economizar-dinheiro-todo-mes" },
  openGraph: {
    title: "Como economizar dinheiro todo mês",
    description: "8 estratégias práticas para sobrar mais no fim do mês.",
    locale: "pt_BR",
    type: "article",
  },
}

const FAQ: FaqItem[] = [
  {
    q: "Qual o jeito mais rápido de economizar?",
    a: "Atacar os gastos fixos. Renegociar aluguel, plano de celular, internet e cancelar assinaturas que não usa gera economia que se repete todos os meses, sem esforço contínuo.",
  },
  {
    q: "Como economizar ganhando pouco?",
    a: "Foque no controle, não no valor. Registrar cada gasto revela vazamentos que somam muito no fim do mês. E automatize a poupança: separe um valor pequeno assim que a renda cair.",
  },
  {
    q: "Vale a pena economizar pouco por mês?",
    a: "Vale. O hábito importa mais que o valor no começo. R$ 50 por mês viram R$ 600 no ano — e, mais importante, criam a disciplina que permite guardar mais quando a renda crescer.",
  },
]

export default function ComoEconomizarPage() {
  return (
    <ArticleShell
      title="Como economizar dinheiro todo mês"
      lead="Economizar não é sobre cortar tudo que dá prazer — é sobre eliminar desperdícios e fazer escolhas conscientes. Veja 8 estratégias que funcionam de verdade."
      faq={FAQ}
    >
      <h2>1. Saiba quanto gasta antes de cortar</h2>
      <p>
        Não dá para economizar no escuro. Registre seus gastos por um mês —{" "}
        <Link href="/guias/financas-pessoais-para-iniciantes">o primeiro passo de qualquer plano</Link>{" "}
        — e descubra os vazamentos.
      </p>

      <h2>2. Ataque os gastos fixos primeiro</h2>
      <p>
        Renegociar aluguel, plano de celular, internet e seguros gera economia <strong>recorrente</strong>:
        você se esforça uma vez e colhe todo mês. É o corte de maior retorno.
      </p>

      <h2>3. Cancele assinaturas fantasma</h2>
      <p>
        Streamings, apps e mensalidades que você esqueceu que paga. Some tudo: costuma dar um susto.
        Cancele o que não usa nas últimas semanas.
      </p>

      <h2>4. Reduza os gastos invisíveis</h2>
      <p>
        Delivery, cafés, pequenas compras por impulso. Individualmente parecem inofensivos, mas somados
        viram uma fatia enorme do orçamento. Defina um limite mensal para essa categoria.
      </p>

      <h2>5. Use a regra das 24 horas</h2>
      <p>
        Para compras não essenciais, espere 24 horas antes de finalizar. Boa parte da vontade passa, e
        você só compra o que realmente queria.
      </p>

      <h2>6. Automatize a poupança</h2>
      <p>
        Não espere &quot;sobrar&quot; — quase nunca sobra. Separe o valor da meta assim que a renda
        cair. Trate a poupança como uma conta fixa do mês.
      </p>

      <AffiliateCard
        slot="economizarBank"
        intro="Uma conta que rende sozinha ajuda o dinheiro guardado a trabalhar por você:"
      />

      <h2>7. Planeje as compras grandes</h2>
      <p>
        Para objetivos maiores, calcule{" "}
        <Link href="/calculadoras/quanto-guardar-por-mes">quanto guardar por mês</Link> e evite parcelar
        no cartão — juros são o oposto de economizar.
      </p>

      <h2>8. Revise todo mês</h2>
      <p>
        Economia não é evento único. Reserve 15 minutos no fim do mês para ver o que funcionou e ajustar.
        É essa constância que transforma cortes pequenos em patrimônio.
      </p>
    </ArticleShell>
  )
}
