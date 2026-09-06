"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Check, CircleOff, FileUp, FolderPlus, Plus, Undo2 } from "lucide-react"
import { attentionState, dateId, dueDate } from "@/lib/accounts/domain"
import type { AccountOccurrence, AccountsGrid, PayableAccount } from "@/lib/accounts/types"

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100)
}

function inputToCents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".")
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null
}

function stateClass(state: ReturnType<typeof attentionState>) {
  return {
    resolved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    future: "bg-zinc-800/50 text-zinc-500 border-zinc-700/50",
    due_soon: "bg-amber-500/10 text-amber-200 border-amber-500/30",
    due_today: "bg-amber-500/20 text-amber-100 border-amber-400/50",
    overdue: "bg-red-500/15 text-red-200 border-red-500/40",
    missing_due_date: "bg-violet-500/10 text-violet-200 border-violet-500/30",
  }[state]
}

function statusTitle(state: ReturnType<typeof attentionState>, occurrence: AccountOccurrence) {
  if (occurrence.declaration === "paid") return "Pago"
  if (occurrence.declaration === "no_charge") return "Sem cobrança"
  return { future: "Futura", due_soon: "Vence em breve", due_today: "Vence hoje", overdue: "Atrasada", missing_due_date: "Sem vencimento", resolved: "Resolvida" }[state]
}

interface UndoState { occurrence: AccountOccurrence }

export function AnnualGrid() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [reviewMonth, setReviewMonth] = useState(() => new Date().getMonth())
  const [profileId, setProfileId] = useState<string>("all")
  const [grid, setGrid] = useState<AccountsGrid | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showProfiles, setShowProfiles] = useState(false)
  const undoTimer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/accounts?year=${year}&profile=${profileId}`, { cache: "no-store" })
      const body = await response.json() as AccountsGrid & { error?: string }
      if (!response.ok) throw new Error(body.error ?? "Falha ao carregar.")
      setGrid(body); setError(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar.") } finally { setLoading(false) }
  }, [year, profileId])

  // The fetch is an external synchronization; `load` updates state only after its response.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])
  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

  async function patchOccurrence(occurrence: AccountOccurrence, declaration: AccountOccurrence["declaration"], amount?: number) {
    const body = declaration === "paid"
      ? { declaration, paidAmountCents: amount ?? occurrence.expectedAmountCents, paidOn: grid?.today ?? dateId(new Date()), expectedAmountCents: amount }
      : { declaration }
    const response = await fetch(`/api/accounts/occurrences/${occurrence.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (!response.ok) { const data = await response.json().catch(() => ({})) as { error?: string }; setError(data.error ?? "Não foi possível atualizar a ocorrência."); return }
    setUndo({ occurrence }); await load()
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndo(null), 12_000)
  }

  async function undoLast() {
    if (!undo) return
    const { occurrence } = undo
    const body = occurrence.declaration === "paid"
      ? { declaration: "paid", paidAmountCents: occurrence.paidAmountCents, paidOn: occurrence.paidOn, expectedAmountCents: occurrence.expectedAmountCents }
      : { declaration: occurrence.declaration, expectedAmountCents: occurrence.expectedAmountCents }
    const response = await fetch(`/api/accounts/occurrences/${occurrence.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (!response.ok) { setError("Não foi possível desfazer a alteração."); return }
    setUndo(null); await load()
  }

  async function setDueDay(account: PayableAccount) {
    const answer = window.prompt(`Dia de vencimento para ${account.name} (1 a 31):`, account.dueDay?.toString() ?? "")
    if (answer == null) return
    const dueDay = Number(answer)
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) { setError("Informe um dia entre 1 e 31."); return }
    const response = await fetch(`/api/accounts/${account.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dueDay }) })
    if (!response.ok) { setError("Não foi possível salvar o vencimento."); return }
    await load()
  }

  async function setClosingDay(account: PayableAccount) {
    const answer = window.prompt(`Dia de fechamento para ${account.name} (1 a 31):`, account.closingDay?.toString() ?? "")
    if (answer == null) return
    const closingDay = Number(answer)
    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) { setError("Informe um dia entre 1 e 31."); return }
    const response = await fetch(`/api/accounts/${account.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ closingDay }) })
    if (!response.ok) { setError("Não foi possível salvar o fechamento."); return }
    await load()
  }

  const groups = useMemo(() => {
    const result = new Map<string, PayableAccount[]>()
    for (const account of grid?.accounts ?? []) {
      const label = profileId === "all" ? `${account.profileName} · ${account.categoryName}` : account.categoryName
      result.set(label, [...(result.get(label) ?? []), account])
    }
    return [...result.entries()]
  }, [grid, profileId])
  const pendingByMonth = useMemo(() => months.map((_, index) => {
    const id = `${year}-${String(index + 1).padStart(2, "0")}`
    return (grid?.accounts ?? []).reduce((total, account) => total + Number(account.occurrences.some(item => item.referenceMonth === id && !item.declaration)), 0)
  }), [grid, year])
  const totalByMonth = useMemo(() => months.map((_, index) => {
    const id = `${year}-${String(index + 1).padStart(2, "0")}`
    return (grid?.accounts ?? []).reduce((total, account) => total + (account.occurrences.find(item => item.referenceMonth === id)?.expectedAmountCents ?? 0), 0)
  }), [grid, year])
  const today = grid?.today ?? dateId(new Date())

  return <section className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div><h2 className="text-lg font-semibold text-white">Contas a pagar</h2><p className="mt-1 text-sm text-zinc-500">Escolha um perfil ou consulte o consolidado. Verde significa resolvida.</p></div><div className="flex flex-wrap gap-2"><select value={profileId} onChange={event => setProfileId(event.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"><option value="all">Consolidado</option>{grid?.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><button onClick={() => setShowProfiles(true)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500"><FolderPlus className="h-4 w-4" />Perfis</button><button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500"><FileUp className="h-4 w-4" />Importar XLSX</button><button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-400"><Plus className="h-4 w-4" />Nova conta</button></div></header>
    {undo && <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100"><span>Ocorrência atualizada.</span><button onClick={undoLast} className="inline-flex items-center gap-1 font-medium hover:text-white"><Undo2 className="h-4 w-4" />Desfazer</button></div>}
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2"><button onClick={() => setYear(value => value - 1)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Ano anterior"><ChevronLeft className="h-4 w-4" /></button><strong className="tabular-nums text-white">{year}</strong><button onClick={() => setYear(value => value + 1)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Próximo ano"><ChevronRight className="h-4 w-4" /></button></div>
    {grid && <MonthlyReview accounts={grid.accounts} year={year} month={reviewMonth} today={today} onMonthChange={setReviewMonth} onPay={patchOccurrence} />}
    {loading ? <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">Carregando contas…</div> : <><MobileMonthList accounts={grid?.accounts ?? []} year={year} today={today} onPay={patchOccurrence} /><div className="hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 sm:block"><table className="min-w-[1180px] w-full border-collapse text-sm"><thead className="text-xs uppercase tracking-wider text-zinc-500"><tr><th className="sticky left-0 z-20 bg-zinc-900 px-4 py-3 text-left">Conta</th>{months.map((month, index) => <th key={month} className="min-w-24 px-1 py-3 text-center">{month}<span className={`ml-1 text-[10px] ${pendingByMonth[index] ? "text-amber-300" : "text-emerald-400"}`}>{pendingByMonth[index]}</span></th>)}</tr></thead><tbody>{groups.map(([category, accounts]) => <CategoryRows key={category} category={category} accounts={accounts} year={year} today={today} onPay={patchOccurrence} onSetDueDay={setDueDay} onSetClosingDay={setClosingDay} />)}{!groups.length && <tr><td colSpan={13} className="px-4 py-12 text-center text-zinc-500">Nenhuma conta cadastrada. Importe a planilha ou crie a primeira conta.</td></tr>}</tbody><tfoot><tr className="border-t border-zinc-700 bg-zinc-800/60"><th className="sticky left-0 z-10 bg-zinc-800 px-4 py-3 text-left text-xs uppercase tracking-wider text-zinc-300">Total previsto</th>{totalByMonth.map((total, index) => <td key={months[index]} className="px-1 py-3 text-right text-xs font-semibold tabular-nums text-zinc-200">{formatCents(total)}</td>)}</tr></tfoot></table></div></>}
    {showProfiles && <ProfileManager onClose={() => setShowProfiles(false)} onCreated={async profile => { setProfileId(profile.id); setShowProfiles(false); await load() }} />}
    {showAdd && grid && <AccountForm grid={grid} selectedProfileId={profileId === "all" ? null : profileId} onClose={() => setShowAdd(false)} onSaved={async () => { setShowAdd(false); await load() }} />}
    {showImport && grid && <ImportForm grid={grid} selectedProfileId={profileId === "all" ? null : profileId} onClose={() => setShowImport(false)} onImported={async () => { setShowImport(false); await load() }} />}
  </section>
}

function CategoryRows({ category, accounts, year, today, onPay, onSetDueDay, onSetClosingDay }: { category: string; accounts: PayableAccount[]; year: number; today: string; onPay: (occurrence: AccountOccurrence, declaration: AccountOccurrence["declaration"], amount?: number) => Promise<void>; onSetDueDay: (account: PayableAccount) => Promise<void>; onSetClosingDay: (account: PayableAccount) => Promise<void> }) {
  return <><tr><td colSpan={13} className="border-y border-zinc-800 bg-zinc-800/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{category}</td></tr>{accounts.map(account => <AccountRow key={account.id} account={account} year={year} today={today} onPay={onPay} onSetDueDay={onSetDueDay} onSetClosingDay={onSetClosingDay} />)}</>
}

function AccountRow({ account, year, today, onPay, onSetDueDay, onSetClosingDay }: { account: PayableAccount; year: number; today: string; onPay: (occurrence: AccountOccurrence, declaration: AccountOccurrence["declaration"], amount?: number) => Promise<void>; onSetDueDay: (account: PayableAccount) => Promise<void>; onSetClosingDay: (account: PayableAccount) => Promise<void> }) {
  return <tr className="border-b border-zinc-800/70"><td className="sticky left-0 z-10 bg-zinc-900 px-4 py-2 text-zinc-200"><div>{account.name}</div><small className="text-zinc-600">{account.walletName}{account.dueDay ? ` · vence dia ${account.dueDay}` : <button onClick={() => onSetDueDay(account)} className="ml-1 text-violet-300 underline">definir vencimento</button>}{account.accountType === "credit_card" && (account.closingDay ? ` · fecha dia ${account.closingDay}` : <button onClick={() => onSetClosingDay(account)} className="ml-1 text-violet-300 underline">definir fechamento</button>)}</small></td>{months.map((_, index) => { const month = `${year}-${String(index + 1).padStart(2, "0")}`; const occurrence = account.occurrences.find(item => item.referenceMonth === month); return <td key={month} className="p-1 align-top">{occurrence && <OccurrenceCell occurrence={occurrence} dueDay={account.dueDay} today={today} cellId={`${account.id}:${month}`} onPay={onPay} />}</td> })}</tr>
}

function OccurrenceCell({ occurrence, dueDay, today, cellId, onPay }: { occurrence: AccountOccurrence; dueDay: number | null; today: string; cellId: string; onPay: (occurrence: AccountOccurrence, declaration: AccountOccurrence["declaration"], amount?: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState((occurrence.paidAmountCents ?? occurrence.expectedAmountCents) / 100 + "")
  const state = attentionState(occurrence, dueDay, today, 5)
  const commit = async () => { const cents = inputToCents(value); if (cents != null) await onPay(occurrence, "paid", cents); setEditing(false) }
  const variation = occurrence.declaration === "paid" && occurrence.expectedAmountCents > 0 && occurrence.paidAmountCents !== occurrence.expectedAmountCents
    ? Math.round((((occurrence.paidAmountCents ?? 0) - occurrence.expectedAmountCents) / occurrence.expectedAmountCents) * 100) : null
  const itemDetails = occurrence.invoiceItems.map(item => `${item.description}: ${formatCents(item.amountCents)}`).join("\n")
  return <div className={`min-h-15 rounded-lg border p-1 ${stateClass(state)}`} title={[statusTitle(state, occurrence), itemDetails].filter(Boolean).join("\n")}>{editing && !occurrence.declaration ? <input autoFocus data-cell={cellId} inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} onKeyDown={async event => { if (event.key === "Enter") await commit(); if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); const all = [...document.querySelectorAll<HTMLInputElement>("input[data-cell]")]; const index = all.indexOf(event.currentTarget); const offset = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -12 : 12; all[index + offset]?.focus() } }} className="w-full rounded bg-zinc-950/50 px-1 py-1 text-right text-xs outline-none ring-cyan-400 focus:ring-1" /> : <button data-grid-cell={cellId} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); const buttons = [...document.querySelectorAll<HTMLButtonElement>("button[data-grid-cell]")]; const index = buttons.indexOf(event.currentTarget); const offset = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -12 : 12; buttons[index + offset]?.focus() }} onClick={() => occurrence.declaration ? undefined : onPay(occurrence, "paid")} className="w-full px-1 py-1 text-right text-xs font-medium tabular-nums">{formatCents(occurrence.paidAmountCents ?? occurrence.expectedAmountCents)}</button>}{occurrence.invoiceItems.length > 0 && <p className="px-1 text-right text-[10px] opacity-70">{occurrence.invoiceItems.length} compra{occurrence.invoiceItems.length > 1 ? "s" : ""}</p>}{variation != null && <p className="px-1 text-right text-[10px] opacity-70">{variation > 0 ? "+" : ""}{variation}%</p>}{!occurrence.declaration && <div className="flex justify-between gap-1"><button onClick={() => setEditing(true)} className="rounded px-1 text-[10px] opacity-70 hover:bg-black/20">editar</button><button onClick={() => onPay(occurrence, "no_charge")} className="rounded px-1 text-[10px] opacity-70 hover:bg-black/20">não veio</button></div>}{occurrence.declaration === "paid" && <Check className="ml-1 h-3 w-3" />}{occurrence.declaration === "no_charge" && <CircleOff className="ml-1 h-3 w-3" />}</div>
}

function MonthlyReview({ accounts, year, month, today, onMonthChange, onPay }: {
  accounts: PayableAccount[]
  year: number
  month: number
  today: string
  onMonthChange: (month: number) => void
  onPay: (occurrence: AccountOccurrence, declaration: AccountOccurrence["declaration"], amount?: number) => Promise<void>
}) {
  const monthId = `${year}-${String(month + 1).padStart(2, "0")}`
  const rows = accounts.flatMap(account => {
    const occurrence = account.occurrences.find(item => item.referenceMonth === monthId)
    return occurrence ? [{ account, occurrence }] : []
  }).sort((a, b) => (dueDate(monthId, a.account.dueDay) ?? "9999-99-99").localeCompare(dueDate(monthId, b.account.dueDay) ?? "9999-99-99"))
  const paid = rows.filter(row => row.occurrence.declaration === "paid").reduce((sum, row) => sum + (row.occurrence.paidAmountCents ?? 0), 0)
  const open = rows.filter(row => !row.occurrence.declaration).reduce((sum, row) => sum + row.occurrence.expectedAmountCents, 0)
  const noCharge = rows.filter(row => row.occurrence.declaration === "no_charge").length

  async function payOtherValue(occurrence: AccountOccurrence) {
    const answer = window.prompt("Valor pago (R$):", ((occurrence.paidAmountCents ?? occurrence.expectedAmountCents) / 100).toFixed(2).replace(".", ","))
    if (answer == null) return
    const cents = inputToCents(answer)
    if (cents == null) return
    await onPay(occurrence, "paid", cents)
  }

  return <section className="rounded-2xl border border-cyan-500/30 bg-zinc-900 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-white">Revisar pagamentos do mês</h3><p className="mt-1 text-sm text-zinc-400">Marque cada conta como paga, informe outro valor ou registre que não houve cobrança.</p></div><select value={month} onChange={event => onMonthChange(Number(event.target.value))} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">{months.map((label, index) => <option key={label} value={index}>{label} de {year}</option>)}</select></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3"><SummaryCard label="Pago" value={formatCents(paid)} tone="text-emerald-300" /><SummaryCard label="Em aberto" value={formatCents(open)} tone={open ? "text-amber-200" : "text-emerald-300"} /><SummaryCard label="Sem cobrança" value={String(noCharge)} tone="text-zinc-300" /></div>
    <div className="mt-4 space-y-2">{rows.length ? rows.map(({ account, occurrence }) => {
      const state = attentionState(occurrence, account.dueDay, today, 5)
      const due = dueDate(monthId, account.dueDay)
      const resolved = Boolean(occurrence.declaration)
      return <article key={occurrence.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${stateClass(state)}`}><div><p className="font-medium">{account.name}</p><p className="mt-1 text-xs opacity-75">{account.profileName} · {account.walletName} · {due ? `vence ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${due}T00:00:00Z`))}` : "sem vencimento"}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><span className="mr-1 text-sm font-semibold tabular-nums">{formatCents(occurrence.paidAmountCents ?? occurrence.expectedAmountCents)}</span>{resolved ? <span className="rounded-lg bg-black/20 px-2 py-1 text-xs font-medium">{statusTitle(state, occurrence)}</span> : <><button onClick={() => onPay(occurrence, "paid")} className="rounded-lg bg-emerald-400/20 px-3 py-2 text-xs font-semibold hover:bg-emerald-400/30">Marcar pago</button><button onClick={() => void payOtherValue(occurrence)} className="rounded-lg bg-black/20 px-3 py-2 text-xs hover:bg-black/30">Outro valor</button><button onClick={() => onPay(occurrence, "no_charge")} className="rounded-lg bg-black/20 px-3 py-2 text-xs hover:bg-black/30">Sem cobrança</button></>}</div></article>
    }) : <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-center text-sm text-zinc-500">Não há contas previstas para este mês.</p>}</div>
  </section>
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3"><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-1 font-semibold tabular-nums ${tone}`}>{value}</p></div>
}

function MobileMonthList({ accounts, year, today, onPay }: { accounts: PayableAccount[]; year: number; today: string; onPay: (occurrence: AccountOccurrence, declaration: AccountOccurrence["declaration"], amount?: number) => Promise<void> }) {
  const currentMonth = today.startsWith(`${year}-`) ? today.slice(0, 7) : `${year}-01`
  const rows = accounts.flatMap(account => account.occurrences.filter(item => item.referenceMonth === currentMonth).map(occurrence => ({ account, occurrence })))
  return <div className="space-y-2 sm:hidden">{rows.map(({ account, occurrence }) => { const state = attentionState(occurrence, account.dueDay, today, 5); return <div key={occurrence.id} className={`rounded-xl border p-3 ${stateClass(state)}`}><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{account.name}</p><p className="text-xs opacity-70">{statusTitle(state, occurrence)}{occurrence.invoiceItems.length ? ` · ${occurrence.invoiceItems.length} compras` : ""}</p></div>{!occurrence.declaration ? <button onClick={() => onPay(occurrence, "paid")} className="rounded-lg bg-emerald-400/20 px-3 py-2 text-sm font-semibold">{formatCents(occurrence.expectedAmountCents)}</button> : <span className="text-sm">{formatCents(occurrence.paidAmountCents ?? occurrence.expectedAmountCents)}</span>}</div>{!occurrence.declaration && <button onClick={() => onPay(occurrence, "no_charge")} className="mt-2 text-xs underline opacity-80">Não veio cobrança</button>}</div> })}</div>
}

function ProfileManager({ onClose, onCreated }: { onClose: () => void; onCreated: (profile: { id: string }) => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError(null)
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), type: form.get("type") }) })
    const result = await response.json() as { id?: string; error?: string }
    if (!response.ok || !result.id) { setError(result.error ?? "Não foi possível criar o perfil."); setSaving(false); return }
    await onCreated({ id: result.id })
  }
  return <div className="rounded-2xl border border-violet-500/30 bg-zinc-900 p-5"><div className="mb-2 flex justify-between"><div><h3 className="font-semibold">Novo perfil financeiro</h3><p className="mt-1 text-sm text-zinc-500">Cada perfil organiza contas, cartões e lembretes separadamente.</p></div><button type="button" onClick={onClose} className="text-sm text-zinc-400">Fechar</button></div><form onSubmit={submit} className="grid gap-3 sm:grid-cols-3"><input name="name" required placeholder="Ex.: Empresa, Esposa ou Filho João" className="rounded-lg bg-zinc-800 px-3 py-2 sm:col-span-2" /><select name="type" defaultValue="person" className="rounded-lg bg-zinc-800 px-3 py-2"><option value="person">Pessoa física</option><option value="business">Pessoa jurídica</option><option value="dependent">Dependente</option><option value="other">Outro</option></select><button type="submit" disabled={saving} className="rounded-lg bg-violet-400 px-3 py-2 font-semibold text-zinc-950 disabled:opacity-50">{saving ? "Criando…" : "Criar perfil"}</button>{error && <p className="text-sm text-red-300 sm:col-span-3">{error}</p>}</form></div>
}

function AccountForm({ grid, selectedProfileId, onClose, onSaved }: { grid: AccountsGrid; selectedProfileId: string | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [profileId, setProfileId] = useState(selectedProfileId ?? grid.profiles[0]?.id ?? "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const wallets = grid.wallets.filter(item => item.profileId === profileId)
  const categories = grid.categories.filter(item => item.profileId === profileId)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(null)
    const form = new FormData(event.currentTarget)
    const amount = inputToCents(String(form.get("amount") ?? ""))
    const body = { profileId, name: form.get("name"), walletId: form.get("walletId"), categoryId: form.get("categoryId"), dueDay: form.get("dueDay") || null, closingDay: form.get("closingDay") || null, plannedAmountCents: amount, nature: form.get("nature"), accountType: form.get("accountType"), startMonth: form.get("startMonth"), installments: form.get("installments") || null }
    const response = await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (!response.ok) { const data = await response.json() as { error?: string }; setMessage(data.error ?? "Falha ao salvar."); setSaving(false); return }
    await onSaved()
  }
  return <div className="rounded-2xl border border-cyan-500/30 bg-zinc-900 p-5"><div className="mb-4 flex justify-between"><h3 className="font-semibold">Nova conta</h3><button type="button" onClick={onClose} className="text-sm text-zinc-400">Cancelar</button></div><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><select value={profileId} onChange={event => setProfileId(event.target.value)} required className="rounded-lg bg-zinc-800 px-3 py-2 sm:col-span-2"><option value="" disabled>Selecione o perfil financeiro</option>{grid.profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input name="name" required placeholder="Nome da conta" className="rounded-lg bg-zinc-800 px-3 py-2" /><input name="amount" required inputMode="decimal" placeholder="Valor previsto (R$)" className="rounded-lg bg-zinc-800 px-3 py-2" /><select name="walletId" key={`wallet:${profileId}`} defaultValue={wallets[0]?.id} required className="rounded-lg bg-zinc-800 px-3 py-2">{wallets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="categoryId" key={`category:${profileId}`} defaultValue={categories[0]?.id} required className="rounded-lg bg-zinc-800 px-3 py-2">{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input name="dueDay" type="number" min="1" max="31" placeholder="Dia de vencimento" className="rounded-lg bg-zinc-800 px-3 py-2" /><input name="closingDay" type="number" min="1" max="31" placeholder="Fechamento (cartão)" className="rounded-lg bg-zinc-800 px-3 py-2" /><input name="startMonth" type="month" defaultValue={`${grid.year}-01`} required className="rounded-lg bg-zinc-800 px-3 py-2" /><select name="nature" className="rounded-lg bg-zinc-800 px-3 py-2"><option value="fixed">Fixa</option><option value="variable">Variável</option><option value="installment">Parcelada</option><option value="one_off">Avulsa</option></select><select name="accountType" className="rounded-lg bg-zinc-800 px-3 py-2"><option value="regular">Conta normal</option><option value="credit_card">Fatura de cartão</option></select><input name="installments" type="number" min="1" placeholder="Parcelas (somente parcelada)" className="rounded-lg bg-zinc-800 px-3 py-2" /><button type="submit" disabled={saving || !profileId} className="rounded-lg bg-cyan-500 px-3 py-2 font-semibold text-zinc-950 disabled:opacity-50">{saving ? "Salvando…" : "Salvar conta"}</button>{message && <p className="text-sm text-red-300 sm:col-span-2">{message}</p>}</form></div>
}

function ImportForm({ grid, selectedProfileId, onClose, onImported }: { grid: AccountsGrid; selectedProfileId: string | null; onClose: () => void; onImported: () => Promise<void> }) {
  const [profileId, setProfileId] = useState(selectedProfileId ?? grid.profiles[0]?.id ?? "")
  const [message, setMessage] = useState<string | null>(null); const [saving, setSaving] = useState(false)
  const wallets = grid.wallets.filter(item => item.profileId === profileId)
  const categories = grid.categories.filter(item => item.profileId === profileId)
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setMessage(null); const form = new FormData(event.currentTarget); form.set("profileId", profileId); const response = await fetch("/api/accounts/import", { method: "POST", body: form }); const data = await response.json() as { error?: string; accounts?: number; occurrences?: number; issues?: unknown[] }; if (!response.ok) { setMessage(data.error ?? "Falha ao importar."); setSaving(false); return }; setMessage(`Importados ${data.accounts} contas e ${data.occurrences} ocorrências. ${data.issues?.length ?? 0} itens exigem revisão.`); await onImported() }
  return <div className="rounded-2xl border border-amber-500/30 bg-zinc-900 p-5"><div className="mb-2 flex justify-between"><h3 className="font-semibold">Importar planilha</h3><button type="button" onClick={onClose} className="text-sm text-zinc-400">Fechar</button></div><p className="mb-4 text-sm text-zinc-500">Use a aba <strong>Oficial</strong>. A importação será vinculada ao perfil escolhido.</p><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><select value={profileId} onChange={event => setProfileId(event.target.value)} required className="rounded-lg bg-zinc-800 px-3 py-2 sm:col-span-2"><option value="" disabled>Selecione o perfil financeiro</option>{grid.profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input name="file" type="file" accept=".xlsx" required className="rounded-lg bg-zinc-800 px-3 py-2" /><input name="year" type="number" defaultValue={grid.year} required className="rounded-lg bg-zinc-800 px-3 py-2" /><select name="walletId" key={`import-wallet:${profileId}`} defaultValue={wallets[0]?.id} required className="rounded-lg bg-zinc-800 px-3 py-2">{wallets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="categoryId" key={`import-category:${profileId}`} defaultValue={categories[0]?.id} required className="rounded-lg bg-zinc-800 px-3 py-2">{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="submit" disabled={saving || !profileId} className="rounded-lg bg-amber-400 px-3 py-2 font-semibold text-zinc-950 disabled:opacity-50">{saving ? "Importando…" : "Importar"}</button>{message && <p className="text-sm text-zinc-300 sm:col-span-2">{message}</p>}</form></div>
}
