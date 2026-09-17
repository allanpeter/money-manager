# ADR 0002 — Serviços de aplicação compartilhados e MCP como adaptador

- Status: Aceito
- Data: 17/09/2026

## Contexto

Interface web, assistente, bots, Hermes Agent e secretária precisam observar as
mesmas regras. Replicar regras em rotas, prompts ou ferramentas criaria
comportamentos divergentes.

## Decisão

Casos de uso e regras financeiras residirão em serviços de aplicação. Interface
web, API HTTP, workers de integração e MCP serão adaptadores desses serviços.

O MCP exporá contratos de domínio, como `get_portfolio_performance` e
`get_credit_card_bill`. Não serão expostas ferramentas genéricas de SQL, CRUD
ou persistência.

A primeira versão do MCP será somente leitura. O workspace será derivado da
identidade autenticada e nunca aceito como argumento livre do modelo.

## Consequências

- Trocar Hermes ou outro cliente não altera o núcleo financeiro.
- Alterações no schema não precisam alterar o contrato MCP.
- Autorização, auditoria e limites serão aplicados antes do caso de uso.
- Escritas futuras exigirão idempotência e confirmação explícita.
