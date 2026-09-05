# Money Manager

Sistema interno de contas a pagar com Next.js, PostgreSQL e assistente financeiro
por linguagem natural.

> A aplicação possui login, sessões persistidas no PostgreSQL e isolamento por
> workspace com Row-Level Security. Ainda assim, publique somente atrás de HTTPS
> ou em rede privada/Tailscale.

## Arquitetura

```text
Interface manual ──> sessão autenticada ──> serviços financeiros ──┐
                                                                  ▼
Interface web/Discord/Telegram ──> núcleo opcional da IA ──> PostgreSQL com RLS
```

- O PostgreSQL é a única fonte de dados.
- A identidade do canal é resolvida antes da IA e nunca vem do prompt.
- Toda consulta e escrita usa `workspace_id`; a RLS bloqueia acesso cruzado.
- A OpenAI interpreta linguagem natural, mas não acessa o banco diretamente.
- Toda escrita exige confirmação textual (`sim`) e gera registro de auditoria.
- Mensagens repetidas são idempotentes pelo ID externo.
- Lembretes são reservados no banco antes do envio para evitar duplicidade.
- Os canais são isolados em `lib/channels`; WhatsApp reutilizará o mesmo núcleo.
- A interface manual continua disponível em `/contas`; o chat autenticado fica em
  `/assistente` e usa as mesmas regras dos bots.
- Cadastro, login e todas as operações manuais não dependem da OpenAI nem dos
  bots estarem configurados.

## Perfis financeiros e consolidado

Um mesmo login pode organizar vários perfis financeiros: **Pessoa Física**,
**Pessoa Jurídica**, **Esposa**, **Filhos** ou qualquer outro. Cada perfil tem
carteiras, categorias, contas, cartões e lembretes próprios.

Na tela `/contas`, use o seletor para alternar entre um perfil e
**Consolidado**. A visão consolidada reúne os valores de todos os perfis, mas
mantém a identificação de origem em cada grupo. Crie novos perfis pelo botão
**Perfis**; cada um recebe automaticamente uma carteira e categorias iniciais.

## Cadastro e acesso

Abra `http://servidor:3000/cadastro` e informe nome, e-mail e senha. Não existe
token de configuração. Ao cadastrar:

- o primeiro usuário assume o workspace com os dados já migrados;
- cada usuário seguinte recebe um workspace financeiro separado;
- uma carteira pessoal, categorias básicas e preferências são criadas
  automaticamente;
- o login posterior acontece em `/login`.

Em HTTP interno use `AUTH_COOKIE_SECURE=false`; ao publicar com HTTPS altere
para `true`. O cadastro está aberto porque este é inicialmente um sistema
interno. Antes de expô-lo à internet, adicione convite ou aprovação de cadastro.

## Banco de dados

Banco oficial do homelab:

- host: `192.168.0.41:5432`;
- database/usuário: `money_manager`;
- senha: `PG_MONEY_MANAGER_PASSWORD` em
  `../infra/ansible/secrets.enc.env`.

Usuário, banco, backup e rotação da senha são administrados no repositório
`infra`. Não crie um PostgreSQL local e não grave credenciais em `.env` ou Git.

## Configurar OpenAI, Discord e Telegram

1. Crie uma aplicação e um bot no Discord Developer Portal.
2. Ative `Message Content Intent` na página do bot. Ele é necessário para ler
   mensagens comuns em um canal do servidor.
3. Convide o bot somente para o servidor privado, com permissões de visualizar o
   canal, ler histórico e enviar mensagens.
4. Ative o modo desenvolvedor do Discord e copie seu user ID e os IDs dos canais.
5. Edite o segredo do SOPS:

   ```bash
   sops ../infra/ansible/secrets.enc.env
   ```

6. Adicione:

   ```dotenv
   OPENAI_API_KEY=...
   OPENAI_MODEL=gpt-5.4-mini
   AUTH_COOKIE_SECURE=false
   DISCORD_BOT_TOKEN=...
   DISCORD_ALLOWED_USER_IDS=123456789012345678
   DISCORD_CHANNEL_ID=123456789012345678
   DISCORD_REMINDER_CHANNEL_ID=123456789012345678
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_ALLOWED_USER_IDS=
   REMINDER_POLL_INTERVAL_MS=900000
   ```

`DISCORD_ALLOWED_USER_IDS` e `TELEGRAM_ALLOWED_USER_IDS` servem somente para o
bootstrap anterior ao primeiro cadastro. Depois, use **Configurações** no painel:

1. gere um código para Discord ou Telegram;
2. abra uma conversa privada com o bot;
3. envie `/vincular CODIGO`;
4. o bot passa a usar exclusivamente o workspace desse usuário.

Para Telegram, crie o bot no `@BotFather` com `/newbot` e armazene o token como
`TELEGRAM_BOT_TOKEN`. O worker usa long polling oficial (`getUpdates`) e
`sendMessage`; consultas financeiras em grupos são recusadas.

## Executar

### Docker (ambiente completo)

```bash
sops exec-env ../infra/ansible/secrets.enc.env \
  'docker compose up -d --build'
```

O Compose define três serviços:

- `migrate`: aplica migrations e termina;
- `app`: interface web em `http://servidor:3000/contas`;
- `assistant`: bots Discord/Telegram e avaliador periódico de lembretes, ativado pelo
  profile `assistant`.

Depois de cadastrar os segredos do Discord e OpenAI, ative o worker:

```bash
sops exec-env ../infra/ansible/secrets.enc.env \
  'docker compose --profile assistant up -d --build'
```

O chat da própria interface não depende do worker `assistant`; ele funciona com
o serviço `app` e recebe `OPENAI_API_KEY` pelo Compose. O worker é necessário
para Discord, Telegram e lembretes periódicos.

### Coolify (um único serviço)

Ao usar o `Dockerfile` diretamente no Coolify, o mesmo container inicia a
interface web e, se `DISCORD_BOT_TOKEN` ou `TELEGRAM_BOT_TOKEN` estiver
configurado, o worker dos bots e lembretes. Não exponha outra porta: somente a
porta `3000` da interface é necessária.

Além de `DATABASE_URL`, `DATABASE_SSL`, `AUTH_COOKIE_SECURE=true` e das
variáveis da OpenAI, configure as variáveis do Discord. O log deve conter
`discord assistant ready as ...`. O Compose mantém serviços separados para
facilitar desenvolvimento e operação local.

Para validar a conexão local do bot sem enviar lembretes, execute:

```bash
ASSISTANT_DISABLE_REMINDERS=true DISCORD_ALLOWED_USER_IDS= \
  node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/assistant.ts
```

Logs operacionais:

```bash
sops exec-env ../infra/ansible/secrets.enc.env \
  'docker compose logs -f app assistant'
```

## Exemplos de comandos

```text
Coloque uma compra de R$ 89,90 de combustível no Nubank da pessoa física.
Marque a conta de energia deste mês como paga.
Cadastre internet de R$ 119,90, fixa, vencimento dia 10.
O cartão Nubank fecha dia 4.
Quais contas vencem nos próximos dias?
```

Quando houver ambiguidade ou informação obrigatória ausente, o assistente faz
uma pergunta. Antes de qualquer escrita ele apresenta o resumo e espera `sim` ou
`cancelar`.

Para compras de cartão, configure o dia de fechamento. Assim o sistema decide
se a compra entra na fatura atual ou na próxima. As compras aparecem na grade
anual e atualizam o total da fatura.

## Lembretes

Por padrão, o worker verifica a cada 15 minutos e envia lembretes 7 dias antes,
1 dia antes e no dia do vencimento. A combinação ocorrência/canal/regra/data é
única no banco, portanto reinícios não repetem notificações já enviadas.

Os dias são armazenados em `app_settings.reminder_days_before` e podem ser
alterados no PostgreSQL até existir uma tela de configurações.

## Desenvolvimento

Para trabalhar na interface com hot reload, pare o container web para liberar a
porta 3000 e inicie o Next.js. Banco e segredos continuam vindo do ambiente real:

```bash
npm install
docker compose stop app
sops exec-env ../infra/ansible/secrets.enc.env \
  'export DATABASE_URL="postgres://money_manager:${PG_MONEY_MANAGER_PASSWORD}@192.168.0.41:5432/money_manager"; export DATABASE_SSL=false; npm run dev'
```

Abra `http://localhost:3000/cadastro` para criar uma conta ou `/login` se ela já
existe. Para testar também Discord, Telegram e lembretes, execute em outro terminal:

```bash
sops exec-env ../infra/ansible/secrets.enc.env \
  'export DATABASE_URL="postgres://money_manager:${PG_MONEY_MANAGER_PASSWORD}@192.168.0.41:5432/money_manager"; export DATABASE_SSL=false; npm run assistant'
```

Comandos úteis:

```bash
npm test
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run assistant
```

Use o mesmo invólucro do SOPS para comandos que dependam do banco, OpenAI,
Discord ou Telegram.

## Backup

O CT PostgreSQL executa dumps diários e participa do backup central do homelab.
Para um dump adicional sob demanda:

```bash
sops exec-env ../infra/ansible/secrets.enc.env \
  'export DATABASE_URL="postgres://money_manager:${PG_MONEY_MANAGER_PASSWORD}@192.168.0.41:5432/money_manager"; npm run db:backup'
```

O arquivo compactado é salvo em `BACKUP_DIR` (`./backups` por padrão). Teste a
restauração periodicamente em uma base descartável, nunca sobre produção.

## Regras dos dados

- Valores monetários são inteiros em centavos.
- Timezone operacional: `America/Sao_Paulo`.
- A planilha importa somente a aba `Oficial`.
- Contas sem vencimento não geram lembretes.
- Compras do assistente guardam origem, data e ID externo para auditoria.
- O histórico recente dos comandos está em `/assistente`.
- Usuários, sessões, memberships e canais vinculados são tabelas de sistema;
  dados financeiros nunca são selecionados sem um workspace autenticado.
