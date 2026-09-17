# ADR 0004 — Painel administrativo operacional e privado

- Status: Aceito
- Data: 17/09/2026

## Contexto

O operador precisa acompanhar cadastros, ativação, uso, satisfação, integrações
e falhas. Não precisa conhecer o patrimônio ou as movimentações dos usuários.

## Decisão

O painel administrativo exibirá identidade da conta, onboarding, atividade,
retenção, feedback, estado das integrações, filas, erros e uso de IA/MCP.

Ele não exibirá saldos, valores, posições, faturas, descrições de transações,
argumentos financeiros enviados às ferramentas ou suas respostas.

Eventos de produto aceitarão somente metadados explicitamente permitidos. Os
perfis administrativos iniciais serão `platform_owner`, `operations`,
`support` e `auditor`, com ações auditadas.

## Consequências

- Telemetria terá schema próprio e sanitizado.
- Logs não poderão usar payloads financeiros indiscriminadamente.
- Um eventual fluxo de suporte com acesso financeiro exigirá outra decisão
  arquitetural e elevação auditada.
- Umami poderá medir navegação; eventos autenticados permanecerão no banco.
