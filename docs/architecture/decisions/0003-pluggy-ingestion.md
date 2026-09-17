# ADR 0003 — Pluggy como fonte de ingestão externa

- Status: Aceito
- Data: 17/09/2026

## Contexto

O produto consolidará contas e patrimônio de instituições como XP, Rico e BTG.
Conectores variam em cobertura, atualização, MFA e formato de dados.

## Decisão

Pluggy será uma fonte externa de ingestão. O PostgreSQL do Money Manager
continuará sendo a fonte de verdade do produto.

Payloads recebidos serão registrados em staging, deduplicados, normalizados e
convertidos em fatos do domínio. Webhooks serão idempotentes e processados de
forma assíncrona. Credenciais da Pluggy permanecerão no servidor e fora do
frontend e do banco de domínio.

O MCP não consultará a Pluggy diretamente para responder perguntas financeiras.

## Consequências

- O produto pode trocar ou combinar provedores no futuro.
- Falhas da Pluggy não impedem consultas aos dados já sincronizados.
- Atualizações, exclusões e reconciliação precisam ser modeladas explicitamente.
- Cobertura real de XP, Rico e BTG será validada antes da produção.
