export interface ContentLink {
  path: string
  title: string
  description: string
}

export const CALCULATORS: ContentLink[] = [
  {
    path: "/calculadoras/reserva-de-emergencia",
    title: "Reserva de emergência",
    description: "Quanto você precisa guardar e em quanto tempo chega lá.",
  },
  {
    path: "/calculadoras/regra-50-30-20",
    title: "Regra 50/30/20",
    description: "Divida seu salário entre necessidades, desejos e poupança.",
  },
  {
    path: "/calculadoras/quanto-guardar-por-mes",
    title: "Quanto guardar por mês",
    description: "Descubra o valor mensal para atingir qualquer meta.",
  },
]

export const GUIDES: ContentLink[] = [
  {
    path: "/guias/financas-pessoais-para-iniciantes",
    title: "Finanças pessoais para iniciantes",
    description: "Por onde começar a organizar o seu dinheiro, passo a passo.",
  },
  {
    path: "/guias/como-economizar-dinheiro-todo-mes",
    title: "Como economizar dinheiro todo mês",
    description: "8 estratégias práticas para sobrar mais no fim do mês.",
  },
  {
    path: "/guias/onde-guardar-reserva-de-emergencia",
    title: "Onde guardar a reserva de emergência",
    description: "As opções com segurança e liquidez para deixar sua reserva.",
  },
  {
    path: "/guias/planilha-de-gastos-ou-app",
    title: "Planilha de gastos ou app?",
    description: "Vantagens e desvantagens de cada um para controlar gastos.",
  },
]
