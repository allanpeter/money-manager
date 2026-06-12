// ============================================================================
// AFILIADOS — configuração central dos links de parceiro.
//
// COMO ATIVAR (faça quando criar as contas):
//   1. Cadastre-se no programa (Hotmart, corretora, banco, rede de afiliados...).
//   2. Pegue o seu LINK DE RASTREAMENTO e cole em `url`.
//   3. Ajuste `label` (texto do botão) e `partner` (nome do parceiro).
//   4. Mude `enabled` para `true`.
//
// Enquanto `enabled` for `false` (ou `url` estiver vazio), NADA aparece no site —
// o <AffiliateCard> simplesmente não renderiza. Assim você publica sem links
// quebrados e ativa cada slot quando estiver pronto.
//
// Lembre-se: `rel="sponsored nofollow"` e o aviso de patrocínio já são aplicados
// automaticamente pelo componente <AffiliateCard>.
// ============================================================================

export interface Affiliate {
  /** Quando false, o slot não aparece no site. */
  enabled: boolean
  /** Texto do botão. */
  label: string
  /** Link de rastreamento do programa de afiliado. */
  url: string
  /** Nome do parceiro, ex.: "Curso X (Hotmart)" ou "Corretora Y". */
  partner: string
}

export type AffiliateSlot =
  | "reservaBroker"   // guia "onde guardar a reserva" → corretora p/ Tesouro/CDB (CPA/RevShare)
  | "iniciantesCourse" // guia "finanças para iniciantes" → curso básico (Hotmart/Eduzz)
  | "economizarBank"  // guia "como economizar" → banco digital / conta que rende (CPL)

export const AFFILIATES: Record<AffiliateSlot, Affiliate> = {
  reservaBroker: {
    enabled: false,
    label: "Abrir conta para investir a reserva",
    url: "",
    partner: "",
  },
  iniciantesCourse: {
    enabled: false,
    label: "Conhecer um curso para começar",
    url: "",
    partner: "",
  },
  economizarBank: {
    enabled: false,
    label: "Abrir uma conta que rende",
    url: "",
    partner: "",
  },
}

/** Retorna o afiliado se ele estiver pronto para exibição, senão `null`. */
export function getAffiliate(slot: AffiliateSlot): Affiliate | null {
  const a = AFFILIATES[slot]
  return a.enabled && a.url ? a : null
}
