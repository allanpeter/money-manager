"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { Bot, Send, UserRound } from "lucide-react"

export interface WebChatMessage {
  id: string
  author: "user" | "assistant"
  text: string
  status?: "pending" | "executed" | "rejected" | "failed"
}

const EXAMPLES = [
  "Crie uma carteira chamada Pessoa Jurídica.",
  "Registre uma compra de R$ 50 de combustível na carteira Pessoal.",
  "Qual é o saldo consolidado deste mês?",
]

export function WebAssistantChat({ initialMessages }: Readonly<{ initialMessages: WebChatMessage[] }>) {
  const [messages, setMessages] = useState(initialMessages)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  async function send(message: string) {
    const content = message.trim()
    if (!content || sending) return

    const requestId = crypto.randomUUID()
    setMessages(current => [...current, { id: `${requestId}:user`, author: "user", text: content }])
    setText("")
    setError(null)
    setSending(true)

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, requestId }),
      })
      const result = await response.json() as { message?: string; status?: WebChatMessage["status"]; storeUpdated?: boolean; error?: string }
      if (!response.ok || !result.message) throw new Error(result.error ?? "Não foi possível enviar a mensagem.")
      setMessages(current => [...current, {
        id: `${requestId}:assistant`,
        author: "assistant",
        text: result.message as string,
        status: result.status,
      }])
      if (result.storeUpdated) window.dispatchEvent(new Event("financial-store-updated"))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a mensagem.")
    } finally {
      setSending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send(text)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="h-[32rem] overflow-y-auto p-4 sm:p-6">
        {!messages.length && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300"><Bot className="h-6 w-6" /></div>
            <h3 className="mt-4 font-medium text-zinc-100">Converse com seus dados financeiros</h3>
            <p className="mt-1 max-w-lg text-sm text-zinc-500">Registre receitas, despesas e recorrências ou consulte seu consolidado. Antes de salvar qualquer mudança, o assistente pedirá sua confirmação.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map(example => (
                <button key={example} type="button" onClick={() => void send(example)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-300 transition hover:border-cyan-500/40 hover:text-cyan-200">
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map(message => (
            <article key={message.id} className={`flex gap-3 ${message.author === "user" ? "justify-end" : "justify-start"}`}>
              {message.author === "assistant" && <span className="mt-1 shrink-0 rounded-lg bg-cyan-500/10 p-2 text-cyan-300"><Bot className="h-4 w-4" /></span>}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.author === "user" ? "bg-cyan-500 text-zinc-950" : "border border-zinc-800 bg-zinc-950 text-zinc-200"}`}>
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.author === "assistant" && message.status === "pending" && <p className="mt-2 text-xs text-amber-300">Aguardando sua resposta</p>}
              </div>
              {message.author === "user" && <span className="mt-1 shrink-0 rounded-lg bg-zinc-800 p-2 text-zinc-300"><UserRound className="h-4 w-4" /></span>}
            </article>
          ))}
          {sending && (
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <span className="rounded-lg bg-cyan-500/10 p-2 text-cyan-300"><Bot className="h-4 w-4" /></span>
              Analisando…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-zinc-800 p-4">
        {error && <p className="mb-2 text-sm text-red-300">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Ex.: lance 3x de R$ 100 no Nubank, ou marque a fatura do Nubank como paga"
            rows={2}
            maxLength={4000}
            disabled={sending}
            className="min-h-12 flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/50 disabled:opacity-60"
          />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Enviar mensagem" className="rounded-xl bg-cyan-500 p-3 text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-600">Enter envia · Shift + Enter quebra a linha · responda “sim” ou “cancelar” às confirmações</p>
      </form>
    </section>
  )
}
