import type { Metadata } from "next"
import Link from "next/link"
import { ArticleShell } from "@/components/content/ArticleShell"
import { AffiliateCard } from "@/components/content/AffiliateCard"
import type { FaqItem } from "@/components/content/Faq"

export const metadata: Metadata = {
  title: "Onde guardar a reserva de emergência em 2026",
  description:
    "As melhores opções para guardar sua reserva de emergência com segurança e liquidez: Tesouro Selic, CDB de liquidez diária e contas que rendem.",
  alternates: { canonical: "/guias/onde-guardar-reserva-de-emergencia" },
  openGraph: {
    title: "Onde guardar a reserva de emergência",
    description: "Segurança e liquidez: as opções para deixar sua reserva.",
    locale: "pt_BR",
    type: "article",
  },
}

const FAQ: FaqItem[] = [
  {
    q: "Reserva de emergência pode ficar na poupança?",
    a: "Pode, mas costuma render menos que outras opções igualmente seguras e líquidas, como o Tesouro Selic e CDBs de liquidez diária. A poupança é simples, mas tende a perder para a inflação.",
  },
  {
    q: "Tesouro Selic ou CDB para a reserva?",
    a: "Os dois servem. O Tesouro Selic é título público com liquidez diária; CDBs de liquidez diária de bancos sólidos têm proteção do FGC até R$ 250 mil por instituição. Compare a rentabilidade e a facilidade de resgate.",
  },
  {
    q: "Posso perder dinheiro na reserva de emergência?",
    a: "Em aplicações pós-fixadas como Tesouro Selic e CDB de liquidez diária, o risco de oscilação é muito baixo. Evite para a reserva ativos voláteis como ações, fundos de risco e cripto.",
  },
]

export default function OndeGuardarReservaPage() {
  return (
    <ArticleShell
      title="Onde guardar a reserva de emergência"
      lead="A reserva precisa de duas coisas: segurança e liquidez. Veja as opções mais usadas para deixar esse dinheiro acessível e rendendo, sem risco de oscilação."
      faq={FAQ}
      cta={{
        title: "Já sabe quanto guardar?",
        description: "Use o app para acompanhar quanto falta para completar sua reserva.",
      }}
    >
      <p>
        Antes de escolher onde guardar, vale saber{" "}
        <Link href="/calculadoras/reserva-de-emergencia">quanto você precisa na reserva</Link>. Definido
        o valor, o foco passa a ser <strong>onde deixar</strong> esse dinheiro.
      </p>

      <h2>As duas regras de ouro</h2>
      <p>
        A reserva existe para imprevistos, então ela precisa de:
      </p>
      <ul>
        <li><strong>Liquidez:</strong> você consegue resgatar rápido, idealmente no mesmo dia.</li>
        <li><strong>Segurança:</strong> sem risco de o valor cair justo quando você precisar.</li>
      </ul>
      <p>
        Por isso, ativos voláteis (ações, cripto, fundos de risco) <strong>não</strong> servem para a
        reserva — eles podem estar em baixa exatamente no momento da emergência.
      </p>

      <h2>Opções mais comuns no Brasil</h2>
      <ul>
        <li>
          <strong>Tesouro Selic:</strong> título público pós-fixado, com liquidez diária e baixíssimo
          risco. Costuma ser a referência para reserva.
        </li>
        <li>
          <strong>CDB de liquidez diária:</strong> emitido por bancos, com proteção do FGC até
          R$ 250 mil por instituição. Procure os que pagam um bom percentual do CDI e permitem resgate
          a qualquer momento.
        </li>
        <li>
          <strong>Contas que rendem / caixinhas:</strong> várias contas digitais oferecem rendimento
          próximo do CDI com resgate imediato — práticas para uma parte da reserva.
        </li>
      </ul>

      <h2>Como decidir</h2>
      <p>
        Compare a <strong>rentabilidade</strong> (quanto rende em relação ao CDI), a{" "}
        <strong>facilidade de resgate</strong> e a <strong>solidez da instituição</strong>. Muita gente
        divide a reserva entre uma conta que rende (para acesso imediato) e Tesouro Selic ou CDB (para o
        restante).
      </p>

      <AffiliateCard
        slot="reservaBroker"
        intro="Para investir em Tesouro Selic ou CDB você precisa de uma conta em corretora ou banco. Veja uma opção:"
      />

      <p className="text-zinc-500 text-sm">
        Este conteúdo é educacional e não é recomendação de investimento. Avalie seu perfil e, se
        precisar, consulte um profissional habilitado.
      </p>
    </ArticleShell>
  )
}
