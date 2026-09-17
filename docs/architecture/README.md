# Refatoração arquitetural do Money Manager

Este diretório registra as decisões e a execução da transformação da aplicação
v0 em um livro financeiro relacional, auditável e integrável por MCP.

## Fonte de acompanhamento

- [Plano de execução](./refactor-roadmap.md): sequência, status, critérios de
  conclusão e histórico cronológico.
- [Modelo de dados financeiro](./financial-data-model.md): diagrama, dicionário,
  invariantes contábeis e isolamento por workspace.
- [Decisões arquiteturais](./decisions/README.md): índice dos ADRs aceitos.

O plano deve ser atualizado no mesmo commit que altera o status de uma etapa.
Uma etapa só pode ser marcada como concluída depois que seus critérios de saída
forem verificados.
