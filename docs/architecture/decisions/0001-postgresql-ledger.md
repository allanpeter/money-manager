# ADR 0001 — PostgreSQL e ledger de partidas dobradas

- Status: Aceito
- Data: 17/09/2026

## Contexto

A v0 mantém parte do domínio em tabelas relacionais e parte em um documento
JSON. Essa duplicidade produziu caminhos de escrita concorrentes e perda de
dados. O produto passa a ser um livro financeiro completo, incluindo contas,
cartões, planejamento, investimentos e patrimônio.

Não há clientes nem dados da v0 que precisem ser preservados.

## Decisão

O PostgreSQL será a única fonte de verdade financeira. O modelo interno usará
partidas dobradas, com lançamentos compostos por partidas cujo total deve ser
balanceado.

O modelo deve representar ativos, passivos, receitas, despesas e patrimônio.
Transferências, pagamentos de cartão e operações de investimento serão fatos
contábeis, não despesas duplicadas.

O store JSON e as tabelas financeiras incompatíveis serão removidos por uma
migration destrutiva e explícita.

## Consequências

- Totais e patrimônio poderão ser reconstruídos pelo ledger.
- Conciliação e auditoria tornam-se parte do núcleo.
- A interface não conhecerá partidas contábeis diretamente.
- O schema será mais rigoroso, mas elimina correções ad hoc por tela ou agente.
