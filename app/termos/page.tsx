import type { Metadata } from "next"
import { ContentShell } from "@/components/ContentShell"

export const metadata: Metadata = {
  title: "Termos de Uso — Gestor Financeiro",
  description:
    "Termos de uso do Gestor Financeiro: ferramenta gratuita de controle financeiro, sem aconselhamento de investimentos.",
  alternates: { canonical: "/termos" },
}

export default function TermosPage() {
  return (
    <ContentShell title="Termos de Uso" subtitle="Última atualização: maio de 2026">
      <p>
        Ao usar o <strong>Gestor Financeiro</strong>, você concorda com os termos abaixo. Se não
        concordar, não utilize o serviço.
      </p>

      <h2>1. O que é o serviço</h2>
      <p>
        O Gestor Financeiro é uma ferramenta gratuita para organizar entradas, gastos e metas
        financeiras pessoais. O cálculo é feito no seu próprio navegador.
      </p>

      <h2>2. Não é aconselhamento financeiro</h2>
      <p>
        O conteúdo, as calculadoras e as sugestões de distribuição têm caráter{" "}
        <strong>educacional e informativo</strong>. Não constituem recomendação de investimento,
        consultoria financeira, contábil ou jurídica. Decisões sobre seu dinheiro são de sua
        responsabilidade; consulte um profissional habilitado quando necessário.
      </p>

      <h2>3. Responsabilidade pelos dados</h2>
      <p>
        Como seus dados ficam salvos apenas no seu navegador, você é responsável por mantê-los e por
        fazer backups (use a função de exportar). Não nos responsabilizamos por perda de dados
        decorrente de limpeza do navegador, troca de dispositivo ou falhas locais.
      </p>

      <h2>4. Disponibilidade</h2>
      <p>
        O serviço é oferecido &quot;como está&quot;, sem garantia de disponibilidade contínua ou de
        ausência de erros. Podemos alterar ou descontinuar funcionalidades a qualquer momento.
      </p>

      <h2>5. Anúncios e links de terceiros</h2>
      <p>
        O site pode exibir anúncios e links para produtos de terceiros, inclusive financeiros. Não
        controlamos e não nos responsabilizamos pelo conteúdo ou pelas práticas desses terceiros.
      </p>

      <h2>6. Alterações nos termos</h2>
      <p>
        Estes termos podem ser atualizados periodicamente. O uso continuado do serviço após
        alterações representa concordância com a versão vigente.
      </p>
    </ContentShell>
  )
}
