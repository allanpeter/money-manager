# TODO

Lista de decisões e verificações pendentes. Cada item registra o estado atual
do código, o que precisa ser decidido e o próximo passo concreto.

## 1. Notificações: lembretes da IA ou disparo por e-mail?

**Hoje:** só existe push por bot. O worker `scripts/assistant.ts` roda
`dispatchDueReminders` (`lib/reminders/service.ts`) a cada 15 minutos
(`REMINDER_POLL_INTERVAL_MS`) e envia por **Discord ou Telegram**, 7 dias antes,
1 dia antes e no dia do vencimento. Os dias ficam em
`app_settings.reminder_days_before` e só mudam via SQL. Não há e-mail no
projeto: nenhuma dependência de SMTP/Resend/nodemailer.

O worker do Discord já roda em produção (deploy via Dockerfile, que sobe web +
worker no mesmo container), então os lembretes por bot estão ativos.

**Decidir:** e-mail é canal obrigatório para quem não usa Discord/Telegram? Para
usuários de fora, provavelmente sim — bot exige que a pessoa já esteja no
Discord ou Telegram e faça `/vincular`. Se for em frente, escolher provedor e
definir remetente com domínio verificado (SPF/DKIM).

**Próximo passo:** expor `reminder_days_before` numa tela de configurações —
hoje só muda por SQL — antes de multiplicar canais.

## 2. Certificado SSL

**Hoje:** wildcard `*.apps.allanpimentel.com` da Let's Encrypt emitido em
06/06/2026, expirado em 04/09/2026. `https://` dá `certificate has expired`;
o proxy segue de pé (`http://` responde 308 para https).

**Causa provável:** wildcard exige desafio DNS-01; renovação vem falhando desde
~05/08 (30 dias antes do vencimento), tipicamente por credencial do provedor de
DNS expirada. Afeta todos os subdomínios de `apps.allanpimentel.com`.

**Próximo passo:** identificar qual proxy detém o wildcard (NPM/Traefik/Caddy),
ler o log do ACME de agosto, renovar as credenciais do DNS e forçar a renovação.
O container da aplicação não precisa ser tocado.

## 3. Abrir cadastro para outras pessoas e trocar o domínio

**Hoje:** o cadastro **já é aberto** — `registerUser` (`lib/auth/session.ts`)
cria usuário + workspace para qualquer e-mail, sem convite. Não existe
verificação de e-mail, rate limit no `/api/auth/register`, recuperação de senha
nem limite de uso por conta. O domínio `financeiro.apps.allanpimentel.com` é
pessoal e está fixo como default em `app/layout.tsx` e `app/robots.ts`
(sobrescrevível por `NEXT_PUBLIC_SITE_URL`).

**Decidir:** domínio próprio do produto antes ou depois de divulgar.

**Antes de divulgar, o mínimo:** verificação de e-mail, rate limit no cadastro
e no login, fluxo de "esqueci minha senha", e política de retenção/exclusão de
dados (LGPD, já que há dados financeiros e telefone).

## 4. Self-hosted liberado + cobrança pelo hospedado

**Decidir:** licença (algo como AGPL/BSL para self-hosted vs. serviço pago),
o que fica exclusivo da versão hospedada, e preço.

**A favor:** já é 100% self-hostável hoje (Docker + Postgres), então o custo de
liberar é quase zero e serve de aquisição.

**Contra/atenção:** suporte a self-hosters consome tempo; e o hospedado precisa
de algo que justifique pagar — candidatos naturais: integração Pluggy,
notificações, backup gerenciado, WhatsApp.

**Próximo passo:** definir a licença antes de qualquer divulgação — mudar
depois é bem mais difícil.

## 5. Integração com a Pluggy

**Hoje:** nada implementado. Todo lançamento é manual (formulário ou assistente).

**Decidir:** escopo — só leitura de extrato/faturas para conciliar, ou
importação que cria lançamentos automaticamente?

**Pontos técnicos a resolver:**
- onde guardar `itemId`/credenciais da Pluggy por workspace (hoje o store é um
  blob JSON em `financial_stores`; credencial de terceiro não deve ir nele);
- deduplicação: transação importada vs. lançamento manual equivalente;
- conciliação com o modelo de cartão atual (`lib/credit-cards.ts` monta a fatura
  a partir das compras; a Pluggy traz a fatura pronta — decidir quem é a
  verdade);
- custo por conta conectada entra na conta do plano pago.

**Próximo passo:** ler a doc da Pluggy e escrever um spike só de leitura, sem
gravar nada no store.

## 6. Página "Como usar" interna

**Hoje:** o `README.md` tem exemplos de comandos do assistente, mas é doc de
desenvolvedor e não aparece na interface.

**Escopo sugerido:** rota dentro de `app/(app)/` com carteiras, gastos fixos vs.
avulsos, cartões (fechamento × vencimento, parcelas, recorrentes), revisão de
pagamentos, consolidado e frases de exemplo do assistente.

**Próximo passo:** aproveitar os textos que já existem nas telas e no README
para não escrever tudo do zero.

## 7. Vínculo com WhatsApp

**Hoje:** o fluxo de vínculo já existe e é agnóstico de canal — código gerado,
`/vincular CODIGO`, sessão por `channel`/`conversationKey`/`userKey` em
`assistant_sessions`. Discord e Telegram usam exatamente isso, então o
WhatsApp seria um terceiro adaptador, não um sistema novo.

**Decidir:** WhatsApp Business API oficial (custo por conversa, aprovação da
Meta, template de mensagem para o lembrete iniciar conversa) ou biblioteca não
oficial (risco de ban, inviável para produto pago).

**Atenção:** lembrete é mensagem iniciada pelo negócio — no oficial exige
template aprovado, o que muda o formato dos lembretes atuais.

## 8. Verificar o SECURO e talvez trazer para cá

**Pendente de contexto:** registrar aqui o que o SECURO faz hoje, onde roda, e
qual parte faria sentido migrar.

**Decidir:** vira módulo dentro deste app (mesmo login/workspace) ou continua
separado? Se vier para cá, mapear o modelo de dados e se cabe no
`financial_stores` ou precisa de tabelas próprias.

## 9. Importadores de fatura além do CSV do C6

**Hoje:** o Discord aceita um CSV de fatura do C6 como anexo. O fluxo mostra
prévia, exige o vínculo do final do cartão a uma conta cadastrada e só grava
após `sim`. O núcleo está em `lib/invoice-imports/registry.ts`, para que cada
banco ou formato entre por um adaptador próprio, sem alterar o canal nem a
persistência.

**Futuro:** adicionar adaptadores para CSV/OFX/XLSX de outros bancos, PDF de
fatura, print de fatura e foto de nota fiscal. PDF e imagem devem extrair dados
em uma etapa separada e sempre exibir a prévia com confirmação humana antes de
qualquer lançamento; nunca importar valores inferidos automaticamente.

**Próximo passo:** escolher o próximo banco e coletar exemplos anonimizados de
suas exportações para definir o parser e os testes de regressão.
