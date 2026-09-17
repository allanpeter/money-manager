# Plano de execução — livro financeiro completo

Última atualização: **17/09/2026**.

## Objetivo

Substituir a aplicação v0 por um livro financeiro completo, com PostgreSQL como
única fonte de verdade, consolidação patrimonial, comparação informativa com
benchmarks, integrações financeiras via Pluggy, painel administrativo
operacional e acesso de agentes por MCP.

Não há clientes nem dados financeiros da v0 que precisem ser preservados. A
refatoração pode remover de forma explícita o modelo financeiro existente. As
tabelas de identidade e tenancy serão mantidas quando ainda atenderem ao novo
domínio.

## Status

| Passo | Entrega | Status | Início | Conclusão |
|---:|---|---|---|---|
| 1 | Registrar decisões em ADRs | Concluído | 17/09/2026 | 17/09/2026 |
| 2 | Criar o novo esquema relacional | Pendente | — | — |
| 3 | Remover o modelo financeiro atual e o JSON | Pendente | — | — |
| 4 | Implementar ledger e cálculo patrimonial | Pendente | — | — |
| 5 | Refazer a interface sobre o modelo novo | Pendente | — | — |
| 6 | Criar telemetria e painel administrativo | Pendente | — | — |
| 7 | Adicionar MCP somente leitura | Pendente | — | — |
| 8 | Integrar Pluggy no sandbox | Pendente | — | — |
| 9 | Validar XP, Rico e BTG | Pendente | — | — |
| 10 | Adicionar benchmarks e cálculo TWR/XIRR | Pendente | — | — |

Status permitidos: `Pendente`, `Em andamento`, `Bloqueado` e `Concluído`.

## 1. Registrar decisões em ADRs

Decisões registradas:

- PostgreSQL será a única fonte de verdade financeira.
- O núcleo usará partidas dobradas.
- Interface web, workers e MCP chamarão os mesmos serviços de aplicação.
- Pluggy será fonte de ingestão, não fonte de verdade do produto.
- O painel administrativo será operacional e não exibirá valores financeiros.
- Comparações de carteira serão informativas, sem recomendações de investimento.

Critérios de saída:

- [x] ADRs versionados no repositório.
- [x] Limites de domínio e responsabilidades definidos.
- [x] Política de privacidade administrativa registrada.
- [x] Sequência de implementação registrada neste documento.

## 2. Criar o novo esquema relacional

Escopo:

- Identidade e tenancy existentes revisadas.
- Plano de contas interno.
- Lançamentos contábeis e partidas.
- Contas financeiras, cartões e faturas.
- Ativos, operações, posições, lotes e snapshots patrimoniais.
- Planejamento, recorrências, metas e orçamentos.
- Integrações, sincronizações, idempotência e auditoria.
- Telemetria operacional sem conteúdo financeiro.

Critérios de saída:

- [ ] Diagrama e dicionário de dados revisados.
- [ ] Constraints garantem que cada lançamento seja balanceado.
- [ ] Índices e isolamento por workspace definidos.
- [ ] Migration validada em banco descartável.

## 3. Remover o modelo financeiro atual e o JSON

Escopo:

- Remover `financial_stores` e seu endpoint.
- Remover hooks, adapters e tipos do store JSON.
- Remover tabelas financeiras legadas que não façam parte do novo modelo.
- Manter somente autenticação, workspaces e integrações ainda válidas.

Critérios de saída:

- [ ] Nenhum caminho de leitura ou escrita usa JSON financeiro.
- [ ] Nenhuma tabela órfã permanece no schema.
- [ ] Busca estática e testes confirmam a remoção.

## 4. Implementar ledger e cálculo patrimonial

Escopo:

- Casos de uso transacionais para receitas, despesas, transferências, cartões,
  pagamentos, investimentos e rendimentos.
- Conciliação e deduplicação.
- Patrimônio líquido e snapshots diários.
- Auditoria e chaves de idempotência.

Critérios de saída:

- [ ] Invariantes contábeis cobertas por testes.
- [ ] Transferências e pagamentos não duplicam receitas/despesas.
- [ ] Operações de investimento atualizam caixa, posição e custo.
- [ ] Totais podem ser reconstruídos a partir das partidas.

## 5. Refazer a interface sobre o modelo novo

Escopo:

- Dashboard financeiro.
- Contas e transações.
- Cartões e faturas.
- Planejamento e metas.
- Patrimônio e investimentos.
- Estado de sincronização das instituições.

Critérios de saída:

- [ ] UI não acessa tabelas nem detalhes de persistência diretamente.
- [ ] Todas as mutações passam pelos serviços de aplicação.
- [ ] Estados de carregamento, erro e conciliação estão visíveis.
- [ ] Fluxos principais possuem testes.

## 6. Criar telemetria e painel administrativo

Escopo:

- Usuários, onboarding, atividade, retenção e satisfação.
- Saúde das integrações e filas.
- Uso de IA e MCP sem argumentos ou resultados financeiros.
- Feedback, erros, versões e auditoria operacional.

Critérios de saída:

- [ ] Perfis `platform_owner`, `operations`, `support` e `auditor` definidos.
- [ ] Painel não retorna valores, saldos, posições ou descrições financeiras.
- [ ] Metadados de eventos usam lista explícita de campos permitidos.
- [ ] Acessos administrativos são auditados.

## 7. Adicionar MCP somente leitura

Escopo inicial:

- Resumo patrimonial.
- Alocação e desempenho.
- Comparação com benchmark.
- Contas, posições, transações, faturas e estado de sincronização.

Critérios de saída:

- [ ] Ferramentas possuem schemas de entrada e saída versionados.
- [ ] Workspace é derivado da credencial, nunca aceito do modelo.
- [ ] MCP chama os mesmos serviços usados pela interface.
- [ ] Uso, latência e erros são auditados sem conteúdo financeiro no admin.

## 8. Integrar Pluggy no sandbox

Escopo:

- Connect Widget e tokens emitidos exclusivamente no servidor.
- Itens, contas, transações, investimentos e webhooks.
- Staging de payloads, normalização, deduplicação e reprocessamento.
- Segredos fora do banco e do frontend.

Critérios de saída:

- [ ] Fluxo completo validado com conectores sandbox.
- [ ] Webhook responde rapidamente e processa em fila.
- [ ] Eventos repetidos são idempotentes.
- [ ] Exclusões e atualizações do provedor são reconciliadas.

## 9. Validar XP, Rico e BTG

Escopo:

- Cobertura por instituição e tipo de conector.
- Contas, investimentos, transações, MFA e atualização automática.
- Diferenças entre Open Finance e conectores diretos.
- Lacunas como notas de corretagem e dados de custo.

Critérios de saída:

- [ ] Matriz de cobertura real registrada.
- [ ] Jornada de conexão testada por instituição.
- [ ] Operações e posições reconciliadas com amostras conhecidas.
- [ ] Limitações aparecem claramente na interface.

## 10. Adicionar benchmarks e cálculo TWR/XIRR

Escopo:

- Séries de CDI, IPCA, Ibovespa, IFIX, IMA-B e S&P 500.
- Snapshots patrimoniais e fluxos externos.
- TWR para comparação neutra a aportes.
- XIRR para retorno pessoal.
- Volatilidade e drawdown informativos.

Critérios de saída:

- [ ] Fontes e calendários das séries estão documentados.
- [ ] Cálculos possuem testes com casos conhecidos.
- [ ] Comparações usam períodos e moedas compatíveis.
- [ ] Interface deixa claro que não oferece recomendação de investimento.

## Histórico cronológico

### 17/09/2026 — definição do produto e passo 1

- Produto definido como livro financeiro completo, não apenas contas a pagar.
- Migração de dados da v0 descartada por não haver clientes em produção.
- Definido suporte futuro a XP, Rico e BTG por meio da Pluggy.
- Definido MCP como adaptador de serviços de domínio, inicialmente somente
  leitura.
- Definido painel administrativo operacional, sem acesso a valores financeiros.
- Definida análise informativa de desempenho e benchmarks, sem recomendação.
- ADRs iniciais aceitos e passo 1 concluído.

### Contexto anterior relevante

- O store JSON apresentou sobrescrita concorrente e recebeu proteção temporária
  por revisão. Essa proteção deixa de ser necessária quando o passo 3 remover o
  store definitivamente.
- A aplicação possui tabelas relacionais antigas e um store JSON concorrente.
  Nenhum dos dois será tratado como contrato de compatibilidade da nova versão.
