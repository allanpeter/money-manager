# ADR 0005 — Análise patrimonial informativa, sem recomendação

- Status: Aceito
- Data: 17/09/2026

## Contexto

O produto consolidará patrimônio e comparará o desempenho da carteira com
índices. A primeira versão não recomendará compra, venda ou realocação.

## Decisão

O sistema calculará patrimônio, alocação, rentabilidade, TWR, XIRR,
volatilidade e drawdown. A carteira poderá ser comparada com benchmarks como
CDI, IPCA, Ibovespa, IFIX, IMA-B e S&P 500.

Resultados serão apresentados como informação histórica e simulação. A
interface e os agentes não produzirão recomendações personalizadas nem
executarão ordens de investimento nesta fase.

## Consequências

- Snapshots patrimoniais e fluxos externos precisam ser armazenados.
- Séries de benchmarks exigem fonte, calendário, moeda e versionamento.
- TWR será usado para comparação neutra a aportes; XIRR mostrará o retorno
  pessoal considerando os fluxos.
- Recomendações ou execução futura exigirão nova análise regulatória e novo ADR.
