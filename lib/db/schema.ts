import { sql } from "drizzle-orm"
import { bigint, boolean, check, date, index, integer, jsonb, numeric, pgEnum, pgSchema, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core"

export const accountNature = pgEnum("account_nature", ["fixed", "variable", "installment", "one_off"])
export const accountType = pgEnum("account_type", ["regular", "credit_card"])
export const occurrenceDeclaration = pgEnum("occurrence_declaration", ["paid", "no_charge"])
export const expectedSource = pgEnum("expected_source", ["manual", "auto", "import", "assistant"])
export const assistantCommandStatus = pgEnum("assistant_command_status", ["received", "pending", "confirmed", "executed", "rejected", "failed"])
export const workspaceType = pgEnum("workspace_type", ["personal", "shared", "business"])
export const membershipRole = pgEnum("membership_role", ["owner", "editor", "viewer"])
export const identityProvider = pgEnum("identity_provider", ["discord", "telegram", "whatsapp"])
export const financialProfileType = pgEnum("financial_profile_type", ["person", "business", "dependent", "other"])
export const assistantTone = pgEnum("assistant_tone", ["warm", "balanced", "direct"])
export const assistantVerbosity = pgEnum("assistant_verbosity", ["brief", "balanced", "detailed"])

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  assistantPreferredName: text("assistant_preferred_name"),
  assistantTone: assistantTone("assistant_tone").default("balanced").notNull(),
  assistantVerbosity: assistantVerbosity("assistant_verbosity").default("balanced").notNull(),
  assistantGreetings: boolean("assistant_greetings").default(true).notNull(),
  passwordHash: text("password_hash"),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("users_email_unique").on(table.email)])

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: workspaceType("type").default("personal").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const workspaceMemberships = pgTable("workspace_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  role: membershipRole("role").default("owner").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("workspace_memberships_user_workspace_unique").on(table.userId, table.workspaceId)])

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("user_sessions_token_hash_unique").on(table.tokenHash)])

export const externalIdentities = pgTable("external_identities", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: identityProvider("provider").notNull(),
  externalUserId: text("external_user_id").notNull(),
  conversationId: text("conversation_id"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("external_identities_provider_user_unique").on(table.provider, table.externalUserId),
  uniqueIndex("external_identities_user_provider_unique").on(table.userId, table.provider),
])

export const identityLinkCodes = pgTable("identity_link_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  provider: identityProvider("provider").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("identity_link_codes_hash_unique").on(table.codeHash)])

export const financialProfiles = pgTable("financial_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: financialProfileType("type").default("person").notNull(),
  color: text("color").default("#06b6d4").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("financial_profiles_workspace_name_unique").on(table.workspaceId, table.name)])

export const financialStores = pgTable("financial_stores", {
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).primaryKey(),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  revision: integer("revision").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const wallets = pgTable("wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  color: text("color"),
  emoji: text("emoji"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const accountCategories = pgTable("account_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, table => [uniqueIndex("account_categories_workspace_profile_name_unique").on(table.workspaceId, table.profileId, table.name)])

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: "restrict" }).notNull(),
  categoryId: uuid("category_id").references(() => accountCategories.id, { onDelete: "restrict" }).notNull(),
  dueDay: integer("due_day"),
  closingDay: integer("closing_day"),
  plannedAmountCents: bigint("planned_amount_cents", { mode: "number" }).notNull(),
  nature: accountNature("nature").notNull(),
  accountType: accountType("account_type").default("regular").notNull(),
  startMonth: date("start_month").notNull(),
  installments: integer("installments"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const importBatches = pgTable("import_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  filename: text("filename").notNull(),
  checksum: text("checksum").notNull(),
  summary: jsonb("summary").notNull().default(sql`'{}'::jsonb`),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("import_batches_workspace_checksum_unique").on(table.workspaceId, table.checksum)])

export const accountOccurrences = pgTable("account_occurrences", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  referenceMonth: date("reference_month").notNull(),
  expectedAmountCents: bigint("expected_amount_cents", { mode: "number" }).notNull(),
  expectedSource: expectedSource("expected_source").default("manual").notNull(),
  declaration: occurrenceDeclaration("declaration"),
  paidAmountCents: bigint("paid_amount_cents", { mode: "number" }),
  paidOn: date("paid_on"),
  legacyPaymentDateMissing: boolean("legacy_payment_date_missing").default(false).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  importBatchId: uuid("import_batch_id").references(() => importBatches.id, { onDelete: "set null" }),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("account_occurrences_account_month_unique").on(table.accountId, table.referenceMonth)])

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  occurrenceId: uuid("occurrence_id").references(() => accountOccurrences.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  purchasedOn: date("purchased_on").notNull().default(sql`CURRENT_DATE`),
  source: text("source").notNull().default("manual"),
  externalId: text("external_id"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("invoice_items_external_id_unique").on(table.externalId)])

export const appSettings = pgTable("app_settings", {
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).primaryKey(),
  dueSoonDays: integer("due_soon_days").default(5).notNull(),
  inactiveAfterMonths: integer("inactive_after_months").default(6).notNull(),
  reminderDaysBefore: integer("reminder_days_before").array().default(sql`ARRAY[7, 1]::integer[]`).notNull(),
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
})

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  occurrenceId: uuid("occurrence_id").references(() => accountOccurrences.id, { onDelete: "cascade" }).notNull(),
  channel: text("channel").notNull().default("discord"),
  rule: text("rule").notNull(),
  sentForDate: date("sent_for_date").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  result: text("result").notNull(),
}, table => [uniqueIndex("notification_deliveries_once").on(table.occurrenceId, table.channel, table.rule, table.sentForDate)])

export const assistantSessions = pgTable("assistant_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  channel: text("channel").notNull(),
  conversationKey: text("conversation_key").notNull(),
  userKey: text("user_key").notNull(),
  pendingAction: jsonb("pending_action").$type<unknown>(),
  lastGreetedOn: date("last_greeted_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("assistant_sessions_identity_unique").on(table.workspaceId, table.channel, table.conversationKey, table.userKey)])

export const assistantCommands = pgTable("assistant_commands", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  channel: text("channel").notNull(),
  externalMessageId: text("external_message_id").notNull(),
  externalUserId: text("external_user_id").notNull(),
  rawText: text("raw_text").notNull(),
  status: assistantCommandStatus("status").notNull().default("received"),
  interpretedAction: jsonb("interpreted_action").$type<unknown>(),
  result: jsonb("result").$type<unknown>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("assistant_commands_message_unique").on(table.channel, table.externalMessageId)])

export const importIssues = pgTable("import_issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  batchId: uuid("batch_id").references(() => importBatches.id, { onDelete: "cascade" }).notNull(),
  sheet: text("sheet").notNull(),
  cell: text("cell").notNull(),
  rawValue: text("raw_value"),
  reason: text("reason").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
})

// Livro financeiro v1. O schema `finance` nasce de forma aditiva na etapa 2;
// as tabelas financeiras legadas só serão removidas na etapa 3 do roadmap.
export const finance = pgSchema("finance")
export const operations = pgSchema("ops")

export const financialAccountKind = finance.enum("financial_account_kind", ["checking", "savings", "cash", "credit_card", "investment", "loan", "other"])
export const ledgerAccountClass = finance.enum("ledger_account_class", ["asset", "liability", "equity", "income", "expense"])
export const journalEntryStatus = finance.enum("journal_entry_status", ["pending", "posted", "voided"])
export const transactionKind = finance.enum("transaction_kind", ["income", "expense", "transfer", "card_purchase", "bill_payment", "investment_trade", "investment_income", "fee", "tax", "adjustment"])
export const transactionStatus = finance.enum("transaction_status", ["pending", "posted", "voided"])
export const creditCardBillStatus = finance.enum("credit_card_bill_status", ["open", "closed", "paid", "overdue", "voided"])
export const instrumentType = finance.enum("instrument_type", ["stock", "bdr", "etf", "real_estate_fund", "mutual_fund", "fixed_income", "treasury", "coe", "security", "crypto", "cash", "other"])
export const investmentTransactionKind = finance.enum("investment_transaction_kind", ["buy", "sell", "dividend", "interest", "amortization", "fee", "tax", "transfer_in", "transfer_out", "adjustment"])
export const scheduleFrequency = finance.enum("schedule_frequency", ["weekly", "monthly", "yearly", "custom"])
export const scheduledEntryStatus = finance.enum("scheduled_entry_status", ["planned", "matched", "skipped", "overdue"])
export const providerConnectionStatus = finance.enum("provider_connection_status", ["pending", "connected", "action_required", "error", "disconnected"])
export const providerRecordStatus = finance.enum("provider_record_status", ["pending", "processed", "ignored", "failed"])
export const syncJobStatus = finance.enum("sync_job_status", ["queued", "running", "succeeded", "failed", "canceled"])
export const adminRole = operations.enum("admin_role", ["platform_owner", "operations", "support", "auditor"])
export const agentOperationStatus = operations.enum("agent_operation_status", ["received", "succeeded", "failed", "denied"])

export const financeWorkspaceSettings = finance.table("workspace_settings", {
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).primaryKey(),
  baseCurrency: varchar("base_currency", { length: 3 }).default("BRL").notNull(),
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const institutions = finance.table("institutions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  countryCode: varchar("country_code", { length: 2 }).default("BR").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("institutions_code_unique").on(table.code)])

export const providerConnections = finance.table("provider_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  institutionId: uuid("institution_id").references(() => institutions.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  externalItemId: text("external_item_id").notNull(),
  status: providerConnectionStatus("status").default("pending").notNull(),
  consentExpiresAt: timestamp("consent_expires_at", { withTimezone: true }),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("provider_connections_provider_item_unique").on(table.provider, table.externalItemId),
  index("provider_connections_workspace_status_idx").on(table.workspaceId, table.status),
])

export const financialAccounts = finance.table("financial_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  institutionId: uuid("institution_id").references(() => institutions.id, { onDelete: "restrict" }),
  providerConnectionId: uuid("provider_connection_id").references(() => providerConnections.id, { onDelete: "set null" }),
  kind: financialAccountKind("kind").notNull(),
  name: text("name").notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  externalAccountId: text("external_account_id"),
  lastFour: varchar("last_four", { length: 4 }),
  currentBalanceMinor: bigint("current_balance_minor", { mode: "number" }),
  balanceAsOf: timestamp("balance_as_of", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("financial_accounts_connection_external_unique").on(table.providerConnectionId, table.externalAccountId),
  index("financial_accounts_workspace_profile_idx").on(table.workspaceId, table.profileId),
])

export const creditCardDetails = finance.table("credit_card_details", {
  financialAccountId: uuid("financial_account_id").references(() => financialAccounts.id, { onDelete: "cascade" }).primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  brand: text("brand"),
  closingDay: integer("closing_day"),
  dueDay: integer("due_day"),
  creditLimitMinor: bigint("credit_limit_minor", { mode: "number" }),
  availableLimitMinor: bigint("available_limit_minor", { mode: "number" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  check("credit_card_details_closing_day_check", sql`${table.closingDay} IS NULL OR ${table.closingDay} BETWEEN 1 AND 31`),
  check("credit_card_details_due_day_check", sql`${table.dueDay} IS NULL OR ${table.dueDay} BETWEEN 1 AND 31`),
])

export const ledgerAccounts = finance.table("ledger_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  financialAccountId: uuid("financial_account_id").references(() => financialAccounts.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  accountClass: ledgerAccountClass("account_class").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("ledger_accounts_workspace_code_unique").on(table.workspaceId, table.code),
  uniqueIndex("ledger_accounts_financial_account_unique").on(table.financialAccountId),
  index("ledger_accounts_workspace_profile_class_idx").on(table.workspaceId, table.profileId, table.accountClass),
])

export const categories = finance.table("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  ledgerAccountId: uuid("ledger_account_id").references(() => ledgerAccounts.id, { onDelete: "restrict" }).notNull(),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  color: text("color"),
  icon: text("icon"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("categories_workspace_profile_name_unique").on(table.workspaceId, table.profileId, table.name)])

export const journalEntries = finance.table("journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  status: journalEntryStatus("status").default("posted").notNull(),
  entryDate: date("entry_date").notNull(),
  description: text("description").notNull(),
  source: text("source").default("manual").notNull(),
  externalReference: text("external_reference"),
  reversalOfId: uuid("reversal_of_id"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  postedAt: timestamp("posted_at", { withTimezone: true }).defaultNow().notNull(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("journal_entries_workspace_external_unique").on(table.workspaceId, table.source, table.externalReference),
  index("journal_entries_workspace_date_idx").on(table.workspaceId, table.entryDate),
])

export const postings = finance.table("postings", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "cascade" }).notNull(),
  ledgerAccountId: uuid("ledger_account_id").references(() => ledgerAccounts.id, { onDelete: "restrict" }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  baseAmountMinor: bigint("base_amount_minor", { mode: "number" }).notNull(),
  memo: text("memo"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  check("postings_amount_nonzero_check", sql`${table.amountMinor} <> 0`),
  check("postings_base_amount_nonzero_check", sql`${table.baseAmountMinor} <> 0`),
  index("postings_journal_entry_idx").on(table.journalEntryId),
  index("postings_workspace_account_idx").on(table.workspaceId, table.ledgerAccountId),
])

export const creditCardBills = finance.table("credit_card_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  financialAccountId: uuid("financial_account_id").references(() => financialAccounts.id, { onDelete: "cascade" }).notNull(),
  referenceMonth: date("reference_month").notNull(),
  closesOn: date("closes_on"),
  dueOn: date("due_on"),
  totalMinor: bigint("total_minor", { mode: "number" }).default(0).notNull(),
  minimumPaymentMinor: bigint("minimum_payment_minor", { mode: "number" }),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  status: creditCardBillStatus("status").default("open").notNull(),
  externalBillId: text("external_bill_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("credit_card_bills_account_month_unique").on(table.financialAccountId, table.referenceMonth),
  index("credit_card_bills_workspace_due_idx").on(table.workspaceId, table.dueOn),
])

export const transactions = finance.table("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "restrict" }).notNull(),
  financialAccountId: uuid("financial_account_id").references(() => financialAccounts.id, { onDelete: "restrict" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  creditCardBillId: uuid("credit_card_bill_id").references(() => creditCardBills.id, { onDelete: "set null" }),
  kind: transactionKind("kind").notNull(),
  status: transactionStatus("status").default("posted").notNull(),
  description: text("description").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  occurredOn: date("occurred_on").notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  merchantName: text("merchant_name"),
  source: text("source").default("manual").notNull(),
  externalId: text("external_id"),
  providerPayloadId: uuid("provider_payload_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  check("transactions_amount_positive_check", sql`${table.amountMinor} > 0`),
  uniqueIndex("transactions_workspace_source_external_unique").on(table.workspaceId, table.source, table.externalId),
  uniqueIndex("transactions_journal_entry_unique").on(table.journalEntryId),
  index("transactions_workspace_date_idx").on(table.workspaceId, table.occurredOn),
])

export const instruments = finance.table("instruments", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: instrumentType("type").notNull(),
  name: text("name").notNull(),
  symbol: text("symbol"),
  isin: text("isin"),
  taxId: text("tax_id"),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  exchange: text("exchange"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("instruments_isin_unique").on(table.isin),
  index("instruments_symbol_idx").on(table.symbol),
])

export const investmentTransactions = finance.table("investment_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  financialAccountId: uuid("financial_account_id").references(() => financialAccounts.id, { onDelete: "restrict" }).notNull(),
  instrumentId: uuid("instrument_id").references(() => instruments.id, { onDelete: "restrict" }).notNull(),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "restrict" }).notNull(),
  kind: investmentTransactionKind("kind").notNull(),
  tradeDate: date("trade_date").notNull(),
  settlementDate: date("settlement_date"),
  quantity: numeric("quantity", { precision: 28, scale: 10 }),
  unitPrice: numeric("unit_price", { precision: 28, scale: 10 }),
  grossAmountMinor: bigint("gross_amount_minor", { mode: "number" }).notNull(),
  feesMinor: bigint("fees_minor", { mode: "number" }).default(0).notNull(),
  taxesMinor: bigint("taxes_minor", { mode: "number" }).default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  externalId: text("external_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  check("investment_transactions_gross_nonnegative_check", sql`${table.grossAmountMinor} >= 0`),
  uniqueIndex("investment_transactions_account_external_unique").on(table.financialAccountId, table.externalId),
  uniqueIndex("investment_transactions_journal_entry_unique").on(table.journalEntryId),
  index("investment_transactions_workspace_date_idx").on(table.workspaceId, table.tradeDate),
])

export const investmentLots = finance.table("investment_lots", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  financialAccountId: uuid("financial_account_id").references(() => financialAccounts.id, { onDelete: "cascade" }).notNull(),
  instrumentId: uuid("instrument_id").references(() => instruments.id, { onDelete: "restrict" }).notNull(),
  acquisitionTransactionId: uuid("acquisition_transaction_id").references(() => investmentTransactions.id, { onDelete: "restrict" }).notNull(),
  acquiredOn: date("acquired_on").notNull(),
  originalQuantity: numeric("original_quantity", { precision: 28, scale: 10 }).notNull(),
  remainingQuantity: numeric("remaining_quantity", { precision: 28, scale: 10 }).notNull(),
  originalCostMinor: bigint("original_cost_minor", { mode: "number" }).notNull(),
  remainingCostMinor: bigint("remaining_cost_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("investment_lots_workspace_position_idx").on(table.workspaceId, table.financialAccountId, table.instrumentId)])

export const positionSnapshots = finance.table("position_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  financialAccountId: uuid("financial_account_id").references(() => financialAccounts.id, { onDelete: "cascade" }).notNull(),
  instrumentId: uuid("instrument_id").references(() => instruments.id, { onDelete: "restrict" }).notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  quantity: numeric("quantity", { precision: 28, scale: 10 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 28, scale: 10 }).notNull(),
  costBasisMinor: bigint("cost_basis_minor", { mode: "number" }).notNull(),
  marketValueMinor: bigint("market_value_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("position_snapshots_position_date_unique").on(table.financialAccountId, table.instrumentId, table.snapshotDate)])

export const portfolioSnapshots = finance.table("portfolio_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  assetsMinor: bigint("assets_minor", { mode: "number" }).notNull(),
  liabilitiesMinor: bigint("liabilities_minor", { mode: "number" }).notNull(),
  netWorthMinor: bigint("net_worth_minor", { mode: "number" }).notNull(),
  externalFlowMinor: bigint("external_flow_minor", { mode: "number" }).default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("portfolio_snapshots_profile_date_unique").on(table.profileId, table.snapshotDate)])

export const recurringRules = finance.table("recurring_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  debitLedgerAccountId: uuid("debit_ledger_account_id").references(() => ledgerAccounts.id, { onDelete: "restrict" }).notNull(),
  creditLedgerAccountId: uuid("credit_ledger_account_id").references(() => ledgerAccounts.id, { onDelete: "restrict" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  frequency: scheduleFrequency("frequency").notNull(),
  interval: integer("interval").default(1).notNull(),
  dayOfMonth: integer("day_of_month"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  nextDueOn: date("next_due_on"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  check("recurring_rules_amount_positive_check", sql`${table.amountMinor} > 0`),
  check("recurring_rules_interval_positive_check", sql`${table.interval} > 0`),
  check("recurring_rules_day_check", sql`${table.dayOfMonth} IS NULL OR ${table.dayOfMonth} BETWEEN 1 AND 31`),
  index("recurring_rules_workspace_next_due_idx").on(table.workspaceId, table.nextDueOn),
])

export const scheduledEntries = finance.table("scheduled_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  recurringRuleId: uuid("recurring_rule_id").references(() => recurringRules.id, { onDelete: "set null" }),
  matchedTransactionId: uuid("matched_transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  dueOn: date("due_on").notNull(),
  expectedAmountMinor: bigint("expected_amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  status: scheduledEntryStatus("status").default("planned").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  check("scheduled_entries_amount_positive_check", sql`${table.expectedAmountMinor} > 0`),
  uniqueIndex("scheduled_entries_rule_due_unique").on(table.recurringRuleId, table.dueOn),
  index("scheduled_entries_workspace_due_idx").on(table.workspaceId, table.dueOn, table.status),
])

export const budgets = finance.table("budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  referenceMonth: date("reference_month").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  check("budgets_amount_nonnegative_check", sql`${table.amountMinor} >= 0`),
  uniqueIndex("budgets_category_month_unique").on(table.categoryId, table.referenceMonth),
])

export const financialGoals = finance.table("financial_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => financialProfiles.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  targetAmountMinor: bigint("target_amount_minor", { mode: "number" }).notNull(),
  currentAmountMinor: bigint("current_amount_minor", { mode: "number" }).default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  targetDate: date("target_date"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [check("financial_goals_target_positive_check", sql`${table.targetAmountMinor} > 0`)])

export const providerWebhookEvents = finance.table("provider_webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  providerConnectionId: uuid("provider_connection_id").references(() => providerConnections.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  externalEventId: text("external_event_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  attempts: integer("attempts").default(0).notNull(),
  lastErrorCode: text("last_error_code"),
}, table => [
  uniqueIndex("provider_webhook_events_provider_event_unique").on(table.provider, table.externalEventId),
  index("provider_webhook_events_pending_idx").on(table.processedAt, table.receivedAt),
])

export const providerRecords = finance.table("provider_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  providerConnectionId: uuid("provider_connection_id").references(() => providerConnections.id, { onDelete: "cascade" }).notNull(),
  resourceType: text("resource_type").notNull(),
  externalId: text("external_id").notNull(),
  contentHash: text("content_hash").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: providerRecordStatus("status").default("pending").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("provider_records_connection_resource_external_unique").on(table.providerConnectionId, table.resourceType, table.externalId),
  index("provider_records_workspace_status_idx").on(table.workspaceId, table.status),
])

export const syncJobs = finance.table("sync_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  providerConnectionId: uuid("provider_connection_id").references(() => providerConnections.id, { onDelete: "cascade" }).notNull(),
  status: syncJobStatus("status").default("queued").notNull(),
  trigger: text("trigger").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  recordsReceived: integer("records_received").default(0).notNull(),
  recordsProcessed: integer("records_processed").default(0).notNull(),
  recordsFailed: integer("records_failed").default(0).notNull(),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("sync_jobs_workspace_status_created_idx").on(table.workspaceId, table.status, table.createdAt)])

export const idempotencyKeys = finance.table("idempotency_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  scope: text("scope").notNull(),
  key: text("key").notNull(),
  requestHash: text("request_hash").notNull(),
  resourceType: text("resource_type"),
  resourceId: uuid("resource_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, table => [uniqueIndex("idempotency_keys_workspace_scope_key_unique").on(table.workspaceId, table.scope, table.key)])

export const platformAdminRoles = operations.table("platform_admin_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: adminRole("role").notNull(),
  grantedByUserId: uuid("granted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, table => [uniqueIndex("platform_admin_roles_user_role_active_unique").on(table.userId, table.role).where(sql`${table.revokedAt} IS NULL`)])

export const productEvents = operations.table("product_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  event: text("event").notNull(),
  feature: text("feature"),
  channel: text("channel").notNull(),
  sessionId: text("session_id"),
  appVersion: text("app_version"),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean>>().default(sql`'{}'::jsonb`).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("product_events_event_occurred_idx").on(table.event, table.occurredAt), index("product_events_workspace_occurred_idx").on(table.workspaceId, table.occurredAt)])

export const feedback = operations.table("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  context: jsonb("context").$type<Record<string, string | number | boolean>>().default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [check("feedback_rating_check", sql`${table.rating} BETWEEN 0 AND 10`), index("feedback_created_idx").on(table.createdAt)])

export const agentClients = operations.table("agent_clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  credentialHash: text("credential_hash").notNull(),
  scopes: text("scopes").array().default(sql`ARRAY[]::text[]`).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("agent_clients_credential_hash_unique").on(table.credentialHash), index("agent_clients_workspace_idx").on(table.workspaceId)])

export const agentOperations = operations.table("agent_operations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  agentClientId: uuid("agent_client_id").references(() => agentClients.id, { onDelete: "set null" }),
  toolName: text("tool_name").notNull(),
  status: agentOperationStatus("status").default("received").notNull(),
  requestHash: text("request_hash"),
  idempotencyKey: text("idempotency_key"),
  durationMs: integer("duration_ms"),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, table => [index("agent_operations_workspace_created_idx").on(table.workspaceId, table.createdAt), index("agent_operations_tool_status_idx").on(table.toolName, table.status)])

export const auditEvents = operations.table("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  agentClientId: uuid("agent_client_id").references(() => agentClients.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  outcome: text("outcome").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean>>().default(sql`'{}'::jsonb`).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("audit_events_workspace_occurred_idx").on(table.workspaceId, table.occurredAt), index("audit_events_action_occurred_idx").on(table.action, table.occurredAt)])
