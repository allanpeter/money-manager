"use client"
import { useState } from "react"
import { useApp } from "./AppDataProvider"
import { Modal } from "@/components/ui/Modal"
import { SegmentedToggle } from "@/components/ui/SegmentedToggle"
import { Field, inputClass } from "@/components/ui/Field"
import { Button } from "@/components/ui/Button"
import { ALL_WALLETS, PaymentMethod } from "@/lib/types"
import { uid, COLORS } from "@/lib/utils"
import { currentMonthId, monthLabel } from "@/lib/months"

type Kind = "income" | "expense"
type Recurrence = "fixed" | "once"

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  credit: "Crédito",
  debit: "Débito",
  cash: "Dinheiro",
}

export function AddEntryModal({ onClose }: Readonly<{ onClose: () => void }>) {
  const app = useApp()

  const defaultWalletId =
    app.activeWalletId !== ALL_WALLETS ? app.activeWalletId : app.wallets[0]?.id ?? ""

  const [kind, setKind] = useState<Kind>("expense")
  const [recurrence, setRecurrence] = useState<Recurrence>("once")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [walletId, setWalletId] = useState(defaultWalletId)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("")
  const [startMonth, setStartMonth] = useState(currentMonthId())
  const [parcelado, setParcelado] = useState(false)
  const [installments, setInstallments] = useState(12)

  const isExpense = kind === "expense"
  const isFixed = recurrence === "fixed"
  const accent = isExpense ? "red" : "emerald"
  const value = Number.parseFloat(amount.replace(",", ".")) || 0
  const canSave = name.trim().length > 0 && value > 0 && walletId !== ""

  function save() {
    if (!canSave) return
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    const parcels = parcelado ? Math.max(1, installments) : undefined

    if (kind === "income" && !isFixed) {
      app.addIncomeTo(walletId, app.activeMonthId, { id: uid(), name: name.trim(), amount: value })
    } else if (kind === "income" && isFixed) {
      app.addRecurringIncomeTo(walletId, {
        id: uid(), name: name.trim(), amount: value, startMonth, installments: parcels,
      })
    } else if (kind === "expense" && !isFixed) {
      app.addExpenseTo(walletId, app.activeMonthId, {
        id: uid(), name: name.trim(), amount: value, type: "variable",
        paymentMethod: paymentMethod || undefined, color,
      })
    } else {
      app.addRecurringExpenseTo(walletId, {
        id: uid(), name: name.trim(), amount: value, color,
        paymentMethod: paymentMethod || undefined, startMonth, installments: parcels,
      })
    }
    onClose()
  }

  return (
    <Modal
      title="Adicionar lançamento"
      subtitle="Responda duas perguntas e o resto é automático"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="ml-auto">Cancelar</Button>
          <Button onClick={save} disabled={!canSave}>Salvar</Button>
        </>
      }
    >
      <Field label="É entrada ou saída?">
        <SegmentedToggle<Kind>
          value={kind}
          onChange={setKind}
          accent={accent}
          options={[
            { value: "income", label: "Entrada" },
            { value: "expense", label: "Saída" },
          ]}
        />
      </Field>

      <Field label="Repete todo mês?" hint={isFixed ? "vira um lançamento fixo" : "só neste mês"}>
        <SegmentedToggle<Recurrence>
          value={recurrence}
          onChange={setRecurrence}
          accent={accent}
          options={[
            { value: "once", label: "Não — avulso" },
            { value: "fixed", label: "Sim — fixo" },
          ]}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Descrição">
          <input
            autoFocus
            className={inputClass}
            placeholder={isExpense ? "Ex.: Aluguel" : "Ex.: Salário"}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>
        <Field label="Valor (R$)">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            enterKeyHint="done"
            className={inputClass}
            placeholder="0,00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === "Enter" && save()}
          />
        </Field>
      </div>

      <Field label="Carteira">
        <select className={inputClass} value={walletId} onChange={e => setWalletId(e.target.value)}>
          {app.wallets.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </Field>

      {isExpense && (
        <Field label="Forma de pagamento" hint="opcional">
          <select
            className={inputClass}
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value as PaymentMethod | "")}
          >
            <option value="">Não informar</option>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map(m => (
              <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
            ))}
          </select>
        </Field>
      )}

      {isFixed ? (
        <>
          <Field label="A partir de">
            <input
              type="month"
              className={inputClass}
              value={startMonth}
              onChange={e => setStartMonth(e.target.value)}
            />
          </Field>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={parcelado}
                onChange={e => setParcelado(e.target.checked)}
                className="accent-cyan-500 w-4 h-4"
              />
              Parcelado
            </label>
            {parcelado && (
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                em
                <input
                  type="number"
                  min={1}
                  className="bg-zinc-800 text-white text-sm rounded-lg px-2 py-1.5 w-16 outline-none border border-zinc-700 focus:border-cyan-500/50 text-center"
                  value={installments}
                  onChange={e => setInstallments(Math.max(1, Number.parseInt(e.target.value) || 1))}
                />
                x
              </label>
            )}
          </div>
        </>
      ) : (
        <p className="text-zinc-500 text-xs">
          Será lançado em <span className="text-zinc-300 capitalize">{monthLabel(app.activeMonthId)}</span>.
        </p>
      )}
    </Modal>
  )
}
