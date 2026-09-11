import { sql } from "drizzle-orm"
import { bigint, boolean, date, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

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
