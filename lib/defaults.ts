import { AppData } from "./types"

export const DEFAULT_DATA: AppData = {
  incomeSources: [
    { id: "1", name: "Salário", amount: 0 },
  ],
  expenseCategories: [
    { id: "1", name: "Assinaturas", amount: 0, type: "fixed", color: "#6366f1" },
    { id: "2", name: "Alimentação", amount: 0, type: "variable", color: "#f59e0b" },
    { id: "3", name: "Transporte", amount: 0, type: "variable", color: "#10b981" },
    { id: "4", name: "Saúde", amount: 0, type: "fixed", color: "#ef4444" },
    { id: "5", name: "Lazer", amount: 0, type: "variable", color: "#8b5cf6" },
    { id: "6", name: "Extras", amount: 0, type: "variable", color: "#ec4899" },
  ],
  investmentBuckets: [
    { id: "1", name: "Reserva de Emergência", percentage: 40, color: "#06b6d4" },
    { id: "2", name: "Viagem", percentage: 20, color: "#f59e0b" },
    { id: "3", name: "Carro", percentage: 20, color: "#10b981" },
    { id: "4", name: "Aporte", percentage: 20, color: "#6366f1" },
  ],
}
