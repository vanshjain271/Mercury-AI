import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260905043100 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "policy" drop constraint if exists "policy_tool_name_unique";`);
    this.addSql(`create table if not exists "agent_action" ("id" text not null, "session_id" text not null, "agent_type" text check ("agent_type" in ('buyer', 'merchant')) not null, "action_type" text not null, "tool_name" text null, "input_summary" jsonb null, "result_summary" jsonb null, "policy_result" text check ("policy_result" in ('allowed', 'blocked', 'approval_required')) null, "duration_ms" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_action_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_action_session_id" ON "agent_action" ("session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_action_deleted_at" ON "agent_action" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_session" ("id" text not null, "agent_type" text check ("agent_type" in ('buyer', 'merchant')) not null, "actor_id" text null, "actor_label" text null, "status" text check ("status" in ('active', 'completed', 'aborted')) not null default 'active', "ended_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_session_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_session_deleted_at" ON "agent_session" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "approval_request" ("id" text not null, "session_id" text null, "action_type" text not null, "summary" text not null, "payload" jsonb not null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "decided_by" text null, "decided_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "approval_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_approval_request_deleted_at" ON "approval_request" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "audit_event" ("id" text not null, "session_id" text null, "actor" text not null, "event_type" text not null, "summary" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "audit_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_event_deleted_at" ON "audit_event" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "campaign_proposal" ("id" text not null, "name" text not null, "objective" text not null, "target_segment" text null, "product_ids" jsonb null, "strategy" text not null, "discount_percent" integer null, "duration_hours" integer null, "estimated_audience" integer null, "projected_revenue_low_inr" integer null, "projected_revenue_high_inr" integer null, "discount_exposure_inr" integer null, "risk" text check ("risk" in ('low', 'medium', 'high')) not null default 'low', "status" text check ("status" in ('draft', 'proposed', 'approved', 'active', 'completed', 'dismissed')) not null default 'draft', "approved_by" text null, "approved_at" timestamptz null, "created_by_session_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "campaign_proposal_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_campaign_proposal_deleted_at" ON "campaign_proposal" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "opportunity" ("id" text not null, "title" text not null, "category" text check ("category" in ('abandoned_cart', 'upsell', 'cross_sell', 'inventory_risk', 'churn_signal', 'bundle')) not null, "severity" text check ("severity" in ('low', 'medium', 'high')) not null default 'medium', "estimated_impact_inr" integer null, "confidence" integer null, "evidence" jsonb null, "recommended_action" text null, "status" text check ("status" in ('new', 'reviewed', 'approved', 'executed', 'completed', 'dismissed')) not null default 'new', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "opportunity_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_opportunity_deleted_at" ON "opportunity" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "policy" ("id" text not null, "tool_name" text not null, "allowed" boolean not null default true, "max_amount_inr" integer null, "requires_approval" boolean not null default false, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "policy_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_policy_tool_name_unique" ON "policy" ("tool_name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_policy_deleted_at" ON "policy" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "policy_evaluation" ("id" text not null, "session_id" text null, "tool_name" text not null, "requested_amount_inr" integer null, "decision" text check ("decision" in ('allowed', 'blocked', 'approval_required')) not null, "reason" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "policy_evaluation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_policy_evaluation_deleted_at" ON "policy_evaluation" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_action" cascade;`);

    this.addSql(`drop table if exists "agent_session" cascade;`);

    this.addSql(`drop table if exists "approval_request" cascade;`);

    this.addSql(`drop table if exists "audit_event" cascade;`);

    this.addSql(`drop table if exists "campaign_proposal" cascade;`);

    this.addSql(`drop table if exists "opportunity" cascade;`);

    this.addSql(`drop table if exists "policy" cascade;`);

    this.addSql(`drop table if exists "policy_evaluation" cascade;`);
  }

}
