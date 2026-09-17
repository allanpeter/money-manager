CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE TYPE "ops"."admin_role" AS ENUM('platform_owner', 'operations', 'support', 'auditor');--> statement-breakpoint
CREATE TYPE "ops"."agent_operation_status" AS ENUM('received', 'succeeded', 'failed', 'denied');--> statement-breakpoint
CREATE TYPE "finance"."credit_card_bill_status" AS ENUM('open', 'closed', 'paid', 'overdue', 'voided');--> statement-breakpoint
CREATE TYPE "finance"."financial_account_kind" AS ENUM('checking', 'savings', 'cash', 'credit_card', 'investment', 'loan', 'other');--> statement-breakpoint
CREATE TYPE "finance"."instrument_type" AS ENUM('stock', 'bdr', 'etf', 'real_estate_fund', 'mutual_fund', 'fixed_income', 'treasury', 'coe', 'security', 'crypto', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "finance"."investment_transaction_kind" AS ENUM('buy', 'sell', 'dividend', 'interest', 'amortization', 'fee', 'tax', 'transfer_in', 'transfer_out', 'adjustment');--> statement-breakpoint
CREATE TYPE "finance"."journal_entry_status" AS ENUM('pending', 'posted', 'voided');--> statement-breakpoint
CREATE TYPE "finance"."ledger_account_class" AS ENUM('asset', 'liability', 'equity', 'income', 'expense');--> statement-breakpoint
CREATE TYPE "finance"."provider_connection_status" AS ENUM('pending', 'connected', 'action_required', 'error', 'disconnected');--> statement-breakpoint
CREATE TYPE "finance"."provider_record_status" AS ENUM('pending', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "finance"."schedule_frequency" AS ENUM('weekly', 'monthly', 'yearly', 'custom');--> statement-breakpoint
CREATE TYPE "finance"."scheduled_entry_status" AS ENUM('planned', 'matched', 'skipped', 'overdue');--> statement-breakpoint
CREATE TYPE "finance"."sync_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "finance"."transaction_kind" AS ENUM('income', 'expense', 'transfer', 'card_purchase', 'bill_payment', 'investment_trade', 'investment_income', 'fee', 'tax', 'adjustment');--> statement-breakpoint
CREATE TYPE "finance"."transaction_status" AS ENUM('pending', 'posted', 'voided');--> statement-breakpoint
CREATE TABLE "ops"."agent_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"credential_hash" text NOT NULL,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"last_used_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."agent_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"agent_client_id" uuid,
	"tool_name" text NOT NULL,
	"status" "ops"."agent_operation_status" DEFAULT 'received' NOT NULL,
	"request_hash" text,
	"idempotency_key" text,
	"duration_ms" integer,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ops"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"actor_user_id" uuid,
	"agent_client_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"outcome" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"reference_month" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_amount_nonnegative_check" CHECK ("finance"."budgets"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"ledger_account_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."credit_card_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"financial_account_id" uuid NOT NULL,
	"reference_month" date NOT NULL,
	"closes_on" date,
	"due_on" date,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"minimum_payment_minor" bigint,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"status" "finance"."credit_card_bill_status" DEFAULT 'open' NOT NULL,
	"external_bill_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."credit_card_details" (
	"financial_account_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"brand" text,
	"closing_day" integer,
	"due_day" integer,
	"credit_limit_minor" bigint,
	"available_limit_minor" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_card_details_closing_day_check" CHECK ("finance"."credit_card_details"."closing_day" IS NULL OR "finance"."credit_card_details"."closing_day" BETWEEN 1 AND 31),
	CONSTRAINT "credit_card_details_due_day_check" CHECK ("finance"."credit_card_details"."due_day" IS NULL OR "finance"."credit_card_details"."due_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE "ops"."feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"source" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_rating_check" CHECK ("ops"."feedback"."rating" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE "finance"."workspace_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"base_currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"institution_id" uuid,
	"provider_connection_id" uuid,
	"kind" "finance"."financial_account_kind" NOT NULL,
	"name" text NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"external_account_id" text,
	"last_four" varchar(4),
	"current_balance_minor" bigint,
	"balance_as_of" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."financial_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount_minor" bigint NOT NULL,
	"current_amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"target_date" date,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_goals_target_positive_check" CHECK ("finance"."financial_goals"."target_amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finance"."institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"country_code" varchar(2) DEFAULT 'BR' NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "finance"."instrument_type" NOT NULL,
	"name" text NOT NULL,
	"symbol" text,
	"isin" text,
	"tax_id" text,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"exchange" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."investment_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"financial_account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"acquisition_transaction_id" uuid NOT NULL,
	"acquired_on" date NOT NULL,
	"original_quantity" numeric(28, 10) NOT NULL,
	"remaining_quantity" numeric(28, 10) NOT NULL,
	"original_cost_minor" bigint NOT NULL,
	"remaining_cost_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."investment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"financial_account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"kind" "finance"."investment_transaction_kind" NOT NULL,
	"trade_date" date NOT NULL,
	"settlement_date" date,
	"quantity" numeric(28, 10),
	"unit_price" numeric(28, 10),
	"gross_amount_minor" bigint NOT NULL,
	"fees_minor" bigint DEFAULT 0 NOT NULL,
	"taxes_minor" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_transactions_gross_nonnegative_check" CHECK ("finance"."investment_transactions"."gross_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" "finance"."journal_entry_status" DEFAULT 'posted' NOT NULL,
	"entry_date" date NOT NULL,
	"description" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_reference" text,
	"reversal_of_id" uuid,
	"created_by_user_id" uuid,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"financial_account_id" uuid,
	"parent_id" uuid,
	"account_class" "finance"."ledger_account_class" NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."platform_admin_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "ops"."admin_role" NOT NULL,
	"granted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finance"."portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"assets_minor" bigint NOT NULL,
	"liabilities_minor" bigint NOT NULL,
	"net_worth_minor" bigint NOT NULL,
	"external_flow_minor" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."position_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"financial_account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"quantity" numeric(28, 10) NOT NULL,
	"unit_price" numeric(28, 10) NOT NULL,
	"cost_basis_minor" bigint NOT NULL,
	"market_value_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"ledger_account_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"base_amount_minor" bigint NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "postings_amount_nonzero_check" CHECK ("finance"."postings"."amount_minor" <> 0),
	CONSTRAINT "postings_base_amount_nonzero_check" CHECK ("finance"."postings"."base_amount_minor" <> 0)
);
--> statement-breakpoint
CREATE TABLE "ops"."product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"event" text NOT NULL,
	"feature" text,
	"channel" text NOT NULL,
	"session_id" text,
	"app_version" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"institution_id" uuid,
	"provider" text NOT NULL,
	"external_item_id" text NOT NULL,
	"status" "finance"."provider_connection_status" DEFAULT 'pending' NOT NULL,
	"consent_expires_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_successful_sync_at" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."provider_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_connection_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"external_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "finance"."provider_record_status" DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."provider_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_connection_id" uuid,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error_code" text
);
--> statement-breakpoint
CREATE TABLE "finance"."recurring_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"debit_ledger_account_id" uuid NOT NULL,
	"credit_ledger_account_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"frequency" "finance"."schedule_frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"day_of_month" integer,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"next_due_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_rules_amount_positive_check" CHECK ("finance"."recurring_rules"."amount_minor" > 0),
	CONSTRAINT "recurring_rules_interval_positive_check" CHECK ("finance"."recurring_rules"."interval" > 0),
	CONSTRAINT "recurring_rules_day_check" CHECK ("finance"."recurring_rules"."day_of_month" IS NULL OR "finance"."recurring_rules"."day_of_month" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE "finance"."scheduled_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"recurring_rule_id" uuid,
	"matched_transaction_id" uuid,
	"description" text NOT NULL,
	"due_on" date NOT NULL,
	"expected_amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"status" "finance"."scheduled_entry_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_entries_amount_positive_check" CHECK ("finance"."scheduled_entries"."expected_amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_connection_id" uuid NOT NULL,
	"status" "finance"."sync_job_status" DEFAULT 'queued' NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"records_received" integer DEFAULT 0 NOT NULL,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"financial_account_id" uuid,
	"category_id" uuid,
	"credit_card_bill_id" uuid,
	"kind" "finance"."transaction_kind" NOT NULL,
	"status" "finance"."transaction_status" DEFAULT 'posted' NOT NULL,
	"description" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"occurred_on" date NOT NULL,
	"posted_at" timestamp with time zone,
	"merchant_name" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"provider_payload_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_positive_check" CHECK ("finance"."transactions"."amount_minor" > 0)
);
--> statement-breakpoint
ALTER TABLE "ops"."agent_clients" ADD CONSTRAINT "agent_clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."agent_operations" ADD CONSTRAINT "agent_operations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."agent_operations" ADD CONSTRAINT "agent_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."agent_operations" ADD CONSTRAINT "agent_operations_agent_client_id_agent_clients_id_fk" FOREIGN KEY ("agent_client_id") REFERENCES "ops"."agent_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."audit_events" ADD CONSTRAINT "audit_events_agent_client_id_agent_clients_id_fk" FOREIGN KEY ("agent_client_id") REFERENCES "ops"."agent_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."budgets" ADD CONSTRAINT "budgets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."budgets" ADD CONSTRAINT "budgets_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."categories" ADD CONSTRAINT "categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."categories" ADD CONSTRAINT "categories_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."categories" ADD CONSTRAINT "categories_ledger_account_id_ledger_accounts_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "finance"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."credit_card_bills" ADD CONSTRAINT "credit_card_bills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."credit_card_bills" ADD CONSTRAINT "credit_card_bills_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "finance"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."credit_card_details" ADD CONSTRAINT "credit_card_details_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "finance"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."credit_card_details" ADD CONSTRAINT "credit_card_details_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."feedback" ADD CONSTRAINT "feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."financial_accounts" ADD CONSTRAINT "financial_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."financial_accounts" ADD CONSTRAINT "financial_accounts_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."financial_accounts" ADD CONSTRAINT "financial_accounts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "finance"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."financial_accounts" ADD CONSTRAINT "financial_accounts_provider_connection_id_provider_connections_id_fk" FOREIGN KEY ("provider_connection_id") REFERENCES "finance"."provider_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."financial_goals" ADD CONSTRAINT "financial_goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."financial_goals" ADD CONSTRAINT "financial_goals_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."idempotency_keys" ADD CONSTRAINT "idempotency_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."investment_lots" ADD CONSTRAINT "investment_lots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."investment_lots" ADD CONSTRAINT "investment_lots_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "finance"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."investment_lots" ADD CONSTRAINT "investment_lots_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "finance"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."investment_lots" ADD CONSTRAINT "investment_lots_acquisition_transaction_id_investment_transactions_id_fk" FOREIGN KEY ("acquisition_transaction_id") REFERENCES "finance"."investment_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."investment_transactions" ADD CONSTRAINT "investment_transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."investment_transactions" ADD CONSTRAINT "investment_transactions_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."investment_transactions" ADD CONSTRAINT "investment_transactions_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "finance"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."investment_transactions" ADD CONSTRAINT "investment_transactions_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "finance"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."investment_transactions" ADD CONSTRAINT "investment_transactions_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ADD CONSTRAINT "ledger_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ADD CONSTRAINT "ledger_accounts_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ADD CONSTRAINT "ledger_accounts_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "finance"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."platform_admin_roles" ADD CONSTRAINT "platform_admin_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."platform_admin_roles" ADD CONSTRAINT "platform_admin_roles_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."position_snapshots" ADD CONSTRAINT "position_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."position_snapshots" ADD CONSTRAINT "position_snapshots_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."position_snapshots" ADD CONSTRAINT "position_snapshots_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "finance"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."position_snapshots" ADD CONSTRAINT "position_snapshots_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "finance"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."postings" ADD CONSTRAINT "postings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."postings" ADD CONSTRAINT "postings_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."postings" ADD CONSTRAINT "postings_ledger_account_id_ledger_accounts_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "finance"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."product_events" ADD CONSTRAINT "product_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."product_events" ADD CONSTRAINT "product_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."provider_connections" ADD CONSTRAINT "provider_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."provider_connections" ADD CONSTRAINT "provider_connections_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."provider_connections" ADD CONSTRAINT "provider_connections_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "finance"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."provider_records" ADD CONSTRAINT "provider_records_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."provider_records" ADD CONSTRAINT "provider_records_provider_connection_id_provider_connections_id_fk" FOREIGN KEY ("provider_connection_id") REFERENCES "finance"."provider_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."provider_webhook_events" ADD CONSTRAINT "provider_webhook_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."provider_webhook_events" ADD CONSTRAINT "provider_webhook_events_provider_connection_id_provider_connections_id_fk" FOREIGN KEY ("provider_connection_id") REFERENCES "finance"."provider_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."recurring_rules" ADD CONSTRAINT "recurring_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."recurring_rules" ADD CONSTRAINT "recurring_rules_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."recurring_rules" ADD CONSTRAINT "recurring_rules_debit_ledger_account_id_ledger_accounts_id_fk" FOREIGN KEY ("debit_ledger_account_id") REFERENCES "finance"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."recurring_rules" ADD CONSTRAINT "recurring_rules_credit_ledger_account_id_ledger_accounts_id_fk" FOREIGN KEY ("credit_ledger_account_id") REFERENCES "finance"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."scheduled_entries" ADD CONSTRAINT "scheduled_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."scheduled_entries" ADD CONSTRAINT "scheduled_entries_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."scheduled_entries" ADD CONSTRAINT "scheduled_entries_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "finance"."recurring_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."scheduled_entries" ADD CONSTRAINT "scheduled_entries_matched_transaction_id_transactions_id_fk" FOREIGN KEY ("matched_transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."sync_jobs" ADD CONSTRAINT "sync_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."sync_jobs" ADD CONSTRAINT "sync_jobs_provider_connection_id_provider_connections_id_fk" FOREIGN KEY ("provider_connection_id") REFERENCES "finance"."provider_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_profile_id_financial_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."financial_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "finance"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_credit_card_bill_id_credit_card_bills_id_fk" FOREIGN KEY ("credit_card_bill_id") REFERENCES "finance"."credit_card_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_clients_credential_hash_unique" ON "ops"."agent_clients" USING btree ("credential_hash");--> statement-breakpoint
CREATE INDEX "agent_clients_workspace_idx" ON "ops"."agent_clients" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_operations_workspace_created_idx" ON "ops"."agent_operations" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_operations_tool_status_idx" ON "ops"."agent_operations" USING btree ("tool_name","status");--> statement-breakpoint
CREATE INDEX "audit_events_workspace_occurred_idx" ON "ops"."audit_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_occurred_idx" ON "ops"."audit_events" USING btree ("action","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_category_month_unique" ON "finance"."budgets" USING btree ("category_id","reference_month");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_workspace_profile_name_unique" ON "finance"."categories" USING btree ("workspace_id","profile_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_card_bills_account_month_unique" ON "finance"."credit_card_bills" USING btree ("financial_account_id","reference_month");--> statement-breakpoint
CREATE INDEX "credit_card_bills_workspace_due_idx" ON "finance"."credit_card_bills" USING btree ("workspace_id","due_on");--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "ops"."feedback" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_accounts_connection_external_unique" ON "finance"."financial_accounts" USING btree ("provider_connection_id","external_account_id");--> statement-breakpoint
CREATE INDEX "financial_accounts_workspace_profile_idx" ON "finance"."financial_accounts" USING btree ("workspace_id","profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_workspace_scope_key_unique" ON "finance"."idempotency_keys" USING btree ("workspace_id","scope","key");--> statement-breakpoint
CREATE UNIQUE INDEX "institutions_code_unique" ON "finance"."institutions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_isin_unique" ON "finance"."instruments" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "instruments_symbol_idx" ON "finance"."instruments" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "investment_lots_workspace_position_idx" ON "finance"."investment_lots" USING btree ("workspace_id","financial_account_id","instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "investment_transactions_account_external_unique" ON "finance"."investment_transactions" USING btree ("financial_account_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "investment_transactions_journal_entry_unique" ON "finance"."investment_transactions" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "investment_transactions_workspace_date_idx" ON "finance"."investment_transactions" USING btree ("workspace_id","trade_date");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_workspace_external_unique" ON "finance"."journal_entries" USING btree ("workspace_id","source","external_reference");--> statement-breakpoint
CREATE INDEX "journal_entries_workspace_date_idx" ON "finance"."journal_entries" USING btree ("workspace_id","entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_workspace_code_unique" ON "finance"."ledger_accounts" USING btree ("workspace_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_financial_account_unique" ON "finance"."ledger_accounts" USING btree ("financial_account_id");--> statement-breakpoint
CREATE INDEX "ledger_accounts_workspace_profile_class_idx" ON "finance"."ledger_accounts" USING btree ("workspace_id","profile_id","account_class");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admin_roles_user_role_active_unique" ON "ops"."platform_admin_roles" USING btree ("user_id","role") WHERE "ops"."platform_admin_roles"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_snapshots_profile_date_unique" ON "finance"."portfolio_snapshots" USING btree ("profile_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "position_snapshots_position_date_unique" ON "finance"."position_snapshots" USING btree ("financial_account_id","instrument_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "postings_journal_entry_idx" ON "finance"."postings" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "postings_workspace_account_idx" ON "finance"."postings" USING btree ("workspace_id","ledger_account_id");--> statement-breakpoint
CREATE INDEX "product_events_event_occurred_idx" ON "ops"."product_events" USING btree ("event","occurred_at");--> statement-breakpoint
CREATE INDEX "product_events_workspace_occurred_idx" ON "ops"."product_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_provider_item_unique" ON "finance"."provider_connections" USING btree ("provider","external_item_id");--> statement-breakpoint
CREATE INDEX "provider_connections_workspace_status_idx" ON "finance"."provider_connections" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_records_connection_resource_external_unique" ON "finance"."provider_records" USING btree ("provider_connection_id","resource_type","external_id");--> statement-breakpoint
CREATE INDEX "provider_records_workspace_status_idx" ON "finance"."provider_records" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_webhook_events_provider_event_unique" ON "finance"."provider_webhook_events" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "provider_webhook_events_pending_idx" ON "finance"."provider_webhook_events" USING btree ("processed_at","received_at");--> statement-breakpoint
CREATE INDEX "recurring_rules_workspace_next_due_idx" ON "finance"."recurring_rules" USING btree ("workspace_id","next_due_on");--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_entries_rule_due_unique" ON "finance"."scheduled_entries" USING btree ("recurring_rule_id","due_on");--> statement-breakpoint
CREATE INDEX "scheduled_entries_workspace_due_idx" ON "finance"."scheduled_entries" USING btree ("workspace_id","due_on","status");--> statement-breakpoint
CREATE INDEX "sync_jobs_workspace_status_created_idx" ON "finance"."sync_jobs" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_workspace_source_external_unique" ON "finance"."transactions" USING btree ("workspace_id","source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_journal_entry_unique" ON "finance"."transactions" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "transactions_workspace_date_idx" ON "finance"."transactions" USING btree ("workspace_id","occurred_on");
--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts"
  ADD CONSTRAINT "ledger_accounts_parent_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "finance"."ledger_accounts"("id")
  ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "finance"."categories"
  ADD CONSTRAINT "categories_parent_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "finance"."categories"("id")
  ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "finance"."journal_entries"
  ADD CONSTRAINT "journal_entries_reversal_of_id_fk"
  FOREIGN KEY ("reversal_of_id") REFERENCES "finance"."journal_entries"("id")
  ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "finance"."transactions"
  ADD CONSTRAINT "transactions_provider_payload_id_fk"
  FOREIGN KEY ("provider_payload_id") REFERENCES "finance"."provider_records"("id")
  ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "finance"."portfolio_snapshots"
  ADD CONSTRAINT "portfolio_snapshots_net_worth_check"
  CHECK ("net_worth_minor" = "assets_minor" - "liabilities_minor");
--> statement-breakpoint
ALTER TABLE "finance"."investment_lots"
  ADD CONSTRAINT "investment_lots_quantities_check"
  CHECK (
    "original_quantity" > 0
    AND "remaining_quantity" >= 0
    AND "remaining_quantity" <= "original_quantity"
  ),
  ADD CONSTRAINT "investment_lots_costs_check"
  CHECK (
    "original_cost_minor" >= 0
    AND "remaining_cost_minor" >= 0
    AND "remaining_cost_minor" <= "original_cost_minor"
  );
--> statement-breakpoint
ALTER TABLE "finance"."sync_jobs"
  ADD CONSTRAINT "sync_jobs_counters_nonnegative_check"
  CHECK (
    "records_received" >= 0
    AND "records_processed" >= 0
    AND "records_failed" >= 0
  );
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid
$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_has_workspace_access(target_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    target_workspace_id = public.app_current_workspace_id()
    AND EXISTS (
      SELECT 1
      FROM public.workspace_memberships membership
      WHERE membership.workspace_id = target_workspace_id
        AND membership.user_id = public.app_current_user_id()
    )
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.app_has_workspace_access(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.app_has_workspace_access(uuid) TO PUBLIC;
--> statement-breakpoint
DO $block$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'workspace_settings',
    'provider_connections',
    'financial_accounts',
    'credit_card_details',
    'ledger_accounts',
    'categories',
    'journal_entries',
    'postings',
    'credit_card_bills',
    'transactions',
    'investment_transactions',
    'investment_lots',
    'position_snapshots',
    'portfolio_snapshots',
    'recurring_rules',
    'scheduled_entries',
    'budgets',
    'financial_goals',
    'provider_webhook_events',
    'provider_records',
    'sync_jobs',
    'idempotency_keys'
  ]
  LOOP
    EXECUTE format('ALTER TABLE finance.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE finance.%I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY workspace_isolation ON finance.%I '
      || 'USING (public.app_has_workspace_access(workspace_id)) '
      || 'WITH CHECK (public.app_has_workspace_access(workspace_id))',
      target_table
    );
  END LOOP;
END
$block$;
--> statement-breakpoint
DO $block$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'product_events',
    'feedback',
    'agent_clients',
    'agent_operations',
    'audit_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE ops.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE ops.%I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY workspace_isolation ON ops.%I '
      || 'USING (workspace_id IS NOT NULL AND public.app_has_workspace_access(workspace_id)) '
      || 'WITH CHECK (workspace_id IS NOT NULL AND public.app_has_workspace_access(workspace_id))',
      target_table
    );
  END LOOP;
END
$block$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION finance.enforce_same_workspace_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, finance
AS $function$
DECLARE
  argument_index integer := 0;
  reference_column text;
  reference_table regclass;
  reference_id uuid;
  reference_matches boolean;
BEGIN
  WHILE argument_index < TG_NARGS LOOP
    reference_column := TG_ARGV[argument_index];
    reference_table := TG_ARGV[argument_index + 1]::regclass;
    reference_id := NULLIF(to_jsonb(NEW) ->> reference_column, '')::uuid;

    IF reference_id IS NOT NULL THEN
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %s WHERE id = $1 AND workspace_id = $2)',
        reference_table
      )
      INTO reference_matches
      USING reference_id, NEW.workspace_id;

      IF NOT reference_matches THEN
        RAISE EXCEPTION
          '% reference %.% does not belong to workspace %',
          TG_TABLE_NAME,
          reference_table,
          reference_id,
          NEW.workspace_id
          USING ERRCODE = '23514';
      END IF;
    END IF;

    argument_index := argument_index + 2;
  END LOOP;

  RETURN NEW;
END
$function$;
--> statement-breakpoint
CREATE TRIGGER provider_connections_workspace_references
BEFORE INSERT OR UPDATE ON finance.provider_connections
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles');
--> statement-breakpoint
CREATE TRIGGER financial_accounts_workspace_references
BEFORE INSERT OR UPDATE ON finance.financial_accounts
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'provider_connection_id', 'finance.provider_connections');
--> statement-breakpoint
CREATE TRIGGER credit_card_details_workspace_references
BEFORE INSERT OR UPDATE ON finance.credit_card_details
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('financial_account_id', 'finance.financial_accounts');
--> statement-breakpoint
CREATE TRIGGER ledger_accounts_workspace_references
BEFORE INSERT OR UPDATE ON finance.ledger_accounts
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'financial_account_id', 'finance.financial_accounts', 'parent_id', 'finance.ledger_accounts');
--> statement-breakpoint
CREATE TRIGGER categories_workspace_references
BEFORE INSERT OR UPDATE ON finance.categories
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'ledger_account_id', 'finance.ledger_accounts', 'parent_id', 'finance.categories');
--> statement-breakpoint
CREATE TRIGGER journal_entries_workspace_references
BEFORE INSERT OR UPDATE ON finance.journal_entries
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'reversal_of_id', 'finance.journal_entries');
--> statement-breakpoint
CREATE TRIGGER postings_workspace_references
BEFORE INSERT OR UPDATE ON finance.postings
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('journal_entry_id', 'finance.journal_entries', 'ledger_account_id', 'finance.ledger_accounts');
--> statement-breakpoint
CREATE TRIGGER credit_card_bills_workspace_references
BEFORE INSERT OR UPDATE ON finance.credit_card_bills
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('financial_account_id', 'finance.financial_accounts');
--> statement-breakpoint
CREATE TRIGGER transactions_workspace_references
BEFORE INSERT OR UPDATE ON finance.transactions
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'journal_entry_id', 'finance.journal_entries', 'financial_account_id', 'finance.financial_accounts', 'category_id', 'finance.categories', 'credit_card_bill_id', 'finance.credit_card_bills', 'provider_payload_id', 'finance.provider_records');
--> statement-breakpoint
CREATE TRIGGER investment_transactions_workspace_references
BEFORE INSERT OR UPDATE ON finance.investment_transactions
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'financial_account_id', 'finance.financial_accounts', 'journal_entry_id', 'finance.journal_entries');
--> statement-breakpoint
CREATE TRIGGER investment_lots_workspace_references
BEFORE INSERT OR UPDATE ON finance.investment_lots
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('financial_account_id', 'finance.financial_accounts', 'acquisition_transaction_id', 'finance.investment_transactions');
--> statement-breakpoint
CREATE TRIGGER position_snapshots_workspace_references
BEFORE INSERT OR UPDATE ON finance.position_snapshots
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'financial_account_id', 'finance.financial_accounts');
--> statement-breakpoint
CREATE TRIGGER portfolio_snapshots_workspace_references
BEFORE INSERT OR UPDATE ON finance.portfolio_snapshots
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles');
--> statement-breakpoint
CREATE TRIGGER recurring_rules_workspace_references
BEFORE INSERT OR UPDATE ON finance.recurring_rules
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'debit_ledger_account_id', 'finance.ledger_accounts', 'credit_ledger_account_id', 'finance.ledger_accounts', 'category_id', 'finance.categories');
--> statement-breakpoint
CREATE TRIGGER scheduled_entries_workspace_references
BEFORE INSERT OR UPDATE ON finance.scheduled_entries
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'recurring_rule_id', 'finance.recurring_rules', 'matched_transaction_id', 'finance.transactions');
--> statement-breakpoint
CREATE TRIGGER budgets_workspace_references
BEFORE INSERT OR UPDATE ON finance.budgets
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles', 'category_id', 'finance.categories');
--> statement-breakpoint
CREATE TRIGGER financial_goals_workspace_references
BEFORE INSERT OR UPDATE ON finance.financial_goals
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('profile_id', 'public.financial_profiles');
--> statement-breakpoint
CREATE TRIGGER provider_webhook_events_workspace_references
BEFORE INSERT OR UPDATE ON finance.provider_webhook_events
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('provider_connection_id', 'finance.provider_connections');
--> statement-breakpoint
CREATE TRIGGER provider_records_workspace_references
BEFORE INSERT OR UPDATE ON finance.provider_records
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('provider_connection_id', 'finance.provider_connections');
--> statement-breakpoint
CREATE TRIGGER sync_jobs_workspace_references
BEFORE INSERT OR UPDATE ON finance.sync_jobs
FOR EACH ROW EXECUTE FUNCTION finance.enforce_same_workspace_references('provider_connection_id', 'finance.provider_connections');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION finance.assert_journal_entry_balanced(target_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  target_status finance.journal_entry_status;
  posting_count bigint;
  balance bigint;
BEGIN
  SELECT status
    INTO target_status
    FROM finance.journal_entries
   WHERE id = target_entry_id;

  IF target_status IS DISTINCT FROM 'posted' THEN
    RETURN;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(base_amount_minor), 0)
    INTO posting_count, balance
    FROM finance.postings
   WHERE journal_entry_id = target_entry_id;

  IF posting_count < 2 OR balance <> 0 THEN
    RAISE EXCEPTION
      'journal entry % is unbalanced: % postings, base balance %',
      target_entry_id,
      posting_count,
      balance
      USING ERRCODE = '23514';
  END IF;
END
$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION finance.check_postings_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM finance.assert_journal_entry_balanced(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.journal_entry_id ELSE NEW.journal_entry_id END
  );

  IF TG_OP = 'UPDATE' AND OLD.journal_entry_id <> NEW.journal_entry_id THEN
    PERFORM finance.assert_journal_entry_balanced(OLD.journal_entry_id);
  END IF;

  RETURN NULL;
END
$function$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER postings_balance_check
AFTER INSERT OR UPDATE OR DELETE ON finance.postings
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION finance.check_postings_balance();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION finance.check_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM finance.assert_journal_entry_balanced(NEW.id);
  RETURN NULL;
END
$function$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_entry_balance_check
AFTER INSERT OR UPDATE OF status ON finance.journal_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION finance.check_journal_entry_balance();
--> statement-breakpoint
COMMENT ON SCHEMA finance IS
  'Fonte de verdade financeira por workspace; valores monetarios sao inteiros na menor unidade.';
--> statement-breakpoint
COMMENT ON SCHEMA ops IS
  'Telemetria operacional e auditoria; nao deve armazenar saldos, posicoes ou descricoes financeiras.';
