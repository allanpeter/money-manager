type EventoHub = {
  tipo: string
  atorEmail?: string
  payload?: Record<string, unknown>
}

function configuracaoHub() {
  const url = process.env.HUB_URL?.trim().replace(/\/+$/, "")
  const token = process.env.HUB_TOKEN_FINANCEIRO?.trim()

  return url && token ? { url, token } : null
}

export async function publicarEventoHub(evento: EventoHub): Promise<void> {
  const config = configuracaoHub()
  if (!config) return

  try {
    const resposta = await fetch(`${config.url}/v1/eventos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(evento),
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    })

    if (!resposta.ok) {
      console.error(`[product-ops] Hub respondeu ${resposta.status} ao registrar ${evento.tipo}`)
    }
  } catch (erro) {
    console.error("[product-ops] Não foi possível registrar evento no Hub", erro)
  }
}
