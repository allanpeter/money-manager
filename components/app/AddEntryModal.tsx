"use client"
import { useState } from "react"
import { useApp } from "./AppDataProvider"
import { Modal } from "@/components/ui/Modal"
import { SegmentedToggle } from "@/components/ui/SegmentedToggle"
import { Field, inputClass } from "@/components/ui/Field"
import { Button } from "@/components/ui/Button"
import { ALL_WALLETS, PaymentMethod } from "@/lib/types"
import { uid, COLORS, formatCurrency } from "@/lib/utils"
import { PurchaseAmountMode, splitPurchase } from "@/lib/credit-cards"
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
  const [dueDay, setDueDay] = useState("")
  const [dueDate, setDueDate] = useState(`${app.activeMonthId}-01`)

  const cardsForWallet = (app.wallets.find(wallet => wallet.id === walletId)?.creditCards ?? []).filter(card => !card.archived)
  const [creditCardId, setCreditCardId] = useState("")
  const [cardRecurring, setCardRecurring] = useState(false)
  /** A card slip can be read as "R$ 300 em 3x" or as "3x de R$ 100"; both save the same purchase. */
  const [cardAmountMode, setCardAmountMode] = useState<PurchaseAmountMode>("total")
  const [newCardName, setNewCardName] = useState("")
  const [newCardLastFour, setNewCardLastFour] = useState("")
  const [newCardClosingDay, setNewCardClosingDay] = useState("25")
  const [newCardDueDay, setNewCardDueDay] = useState("5")

  const isExpense = kind === "expense"
  const isFixed = recurrence === "fixed"
  const isCardPurchase = isExpense && !isFixed && creditCardId !== ""
  const showCreditCard = isExpense && !isFixed && (paymentMethod === "credit" || cardsForWallet.length > 0)
  const accent = isExpense ? "red" : "emerald"
  const value = Number.parseFloat(amount.replace(",", ".")) || 0
  /** Card purchases always store the full value, so "3x de R$ 100" is multiplied back before saving. */
  const cardSplit = splitPurchase(value, !cardRecurring && parcelado ? Math.max(1, installments) : 1, cardRecurring ? "total" : cardAmountMode)
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
    } else if (kind === "expense" && !isFixed && isCardPurchase) {
      app.addCreditCardPurchaseTo(walletId, {
        id: uid(), creditCardId, name: name.trim(), amount: cardSplit.total, purchasedOn: dueDate,
        installments: !cardRecurring && parcelado ? cardSplit.count : undefined,
        recurring: cardRecurring || undefined,
        active: cardRecurring ? true : undefined,
      })
    } else if (kind === "expense" && !isFixed) {
      app.addExpenseTo(walletId, app.activeMonthId, {
        id: uid(), name: name.trim(), amount: value, type: "variable",
        paymentMethod: paymentMethod || undefined, dueDate: dueDate || undefined, color,
      })
    } else {
      app.addRecurringExpenseTo(walletId, {
        id: uid(), name: name.trim(), amount: value, color,
        paymentMethod: paymentMethod || undefined, startMonth, installments: parcels,
        dueDay: dueDay ? Math.min(31, Math.max(1, Number.parseInt(dueDay) || 1)) : undefined,
      })
    }
    onClose()
  }

  function createCreditCard() {
    if (!newCardName.trim() || !walletId) return
    const closingDay = Number(newCardClosingDay)
    const dueDay = Number(newCardDueDay)
    if (closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) return
    const card = {
      id: uid(), name: newCardName.trim(), color: COLORS[Math.floor(Math.random() * COLORS.length)],
      lastFour: newCardLastFour,
      closingDay,
      dueDay,
    }
    app.addCreditCardTo(walletId, card)
    setCreditCardId(card.id)
    setNewCardName("")
    setNewCardLastFour("")
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
        <Field label={isCardPurchase && parcelado && !cardRecurring && cardAmountMode === "installment" ? "Valor da parcela (R$)" : "Valor (R$)"}>
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
        <select className={inputClass} value={walletId} onChange={e => { setWalletId(e.target.value); setCreditCardId("") }}>
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

      {showCreditCard && (
        <Field label="Cartão de crédito" hint="opcional; o vencimento será o do cartão">
          {cardsForWallet.length > 0 ? <select className={inputClass} value={creditCardId} onChange={e => setCreditCardId(e.target.value)}>
              <option value="">Não usar cartão</option>
              {cardsForWallet.map(card => <option key={card.id} value={card.id}>{card.name}{card.lastFour ? ` •••• ${card.lastFour}` : ""} · vence dia {card.dueDay}</option>)}
            </select> : <div className="rounded-xl border border-dashed border-zinc-700 p-3">
              <p className="mb-3 text-xs text-zinc-500">Nenhum cartão cadastrado nesta carteira. Cadastre o primeiro agora:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-zinc-500">Nome do cartão<input value={newCardName} onChange={e => setNewCardName(e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Ex.: Nubank" /></label>
                <label className="text-xs text-zinc-500">Últimos 4 dígitos<input inputMode="numeric" maxLength={4} value={newCardLastFour} onChange={e => setNewCardLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))} className={`mt-1 ${inputClass}`} placeholder="Ex.: 1234" /></label>
                <label className="text-xs text-zinc-500">Dia de fechamento<input inputMode="numeric" maxLength={2} value={newCardClosingDay} onChange={e => setNewCardClosingDay(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={() => { const day = Number(newCardClosingDay); setNewCardClosingDay(day >= 1 && day <= 31 ? String(day) : "25") }} className={`mt-1 ${inputClass}`} /></label>
                <label className="text-xs text-zinc-500">Dia de vencimento<input inputMode="numeric" maxLength={2} value={newCardDueDay} onChange={e => setNewCardDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={() => { const day = Number(newCardDueDay); setNewCardDueDay(day >= 1 && day <= 31 ? String(day) : "5") }} className={`mt-1 ${inputClass}`} /></label>
              </div>
              <p className="mt-2 text-xs text-zinc-600">Fechamento: último dia de compras da fatura. Vencimento: dia para pagar a fatura.</p>
              <button type="button" onClick={createCreditCard} disabled={!newCardName.trim() || newCardLastFour.length !== 4 || Number(newCardClosingDay) < 1 || Number(newCardClosingDay) > 31 || Number(newCardDueDay) < 1 || Number(newCardDueDay) > 31} className="mt-3 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50">Criar cartão</button>
            </div>}
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
          {isExpense && (
            <Field label="Dia de vencimento" hint="opcional; usado para alertas">
              <input
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                className={inputClass}
                placeholder="Ex.: 10"
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
              />
            </Field>
          )}
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
        <>
          {isExpense && <Field label={isCardPurchase ? "Data da compra" : "Data de vencimento"} hint={isCardPurchase ? "define a fatura pelo fechamento do cartão" : "opcional; aparecerá no Consolidado"}>
            <input type="date" className={inputClass} value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Field>}
          {isCardPurchase && <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input type="checkbox" disabled={cardRecurring} checked={parcelado} onChange={e => setParcelado(e.target.checked)} className="accent-cyan-500 w-4 h-4 disabled:opacity-40" />
              Parcelado
            </label>
            {parcelado && <label className="flex items-center gap-2 text-sm text-zinc-400">em<input type="number" min={1} className="bg-zinc-800 text-white text-sm rounded-lg px-2 py-1.5 w-16 outline-none border border-zinc-700 focus:border-cyan-500/50 text-center" value={installments} onChange={e => setInstallments(Math.max(1, Number.parseInt(e.target.value) || 1))} />x</label>}
            {parcelado && <select value={cardAmountMode} onChange={e => setCardAmountMode(e.target.value as PurchaseAmountMode)} className="bg-zinc-800 text-white text-sm rounded-lg px-2 py-1.5 outline-none border border-zinc-700 focus:border-cyan-500/50">
              <option value="total">valor é o total</option>
              <option value="installment">valor é de cada parcela</option>
            </select>}
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input type="checkbox" checked={cardRecurring} onChange={e => { setCardRecurring(e.target.checked); if (e.target.checked) setParcelado(false) }} className="accent-violet-500 w-4 h-4" />
              Recorrente
            </label>
            {cardRecurring && <span className="w-full text-xs text-violet-200">Entrará todo mês na fatura até ser desativada em Lançamentos.</span>}
            {!cardRecurring && parcelado && value > 0 && <span className="w-full text-xs text-violet-200">{cardSplit.first === cardSplit.rest
              ? `${cardSplit.count}x de ${formatCurrency(cardSplit.first)} · total ${formatCurrency(cardSplit.total)}`
              : `${cardSplit.count}x · 1ª de ${formatCurrency(cardSplit.first)} e as demais de ${formatCurrency(cardSplit.rest)} · total ${formatCurrency(cardSplit.total)}`}</span>}
          </div>}
          <p className="text-zinc-500 text-xs">
            {isCardPurchase
              ? "A fatura será calculada conforme a data de fechamento do cartão."
              : <>Será lançado em <span className="text-zinc-300 capitalize">{monthLabel(app.activeMonthId)}</span>.</>}
          </p>
        </>
      )}
    </Modal>
  )
}
