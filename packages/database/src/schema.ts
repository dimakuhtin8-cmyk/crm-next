import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============ ENUMS ============

export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'member']);
export const planEnum = pgEnum('plan', ['free', 'starter', 'professional', 'enterprise']);
export const dealStageEnum = pgEnum('deal_stage', [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done', 'cancelled']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);
export const activityTypeEnum = pgEnum('activity_type', [
  'call',
  'email',
  'message',
  'meeting',
  'note',
  'task',
]);
export const messageChannelEnum = pgEnum('message_channel', [
  'telegram',
  'whatsapp',
  'instagram',
  'email',
  'sms',
]);

// ============ TABLES ============

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  domain: text('domain'),
  plan: planEnum('plan').default('free').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  telegramId: text('telegram_id'),
  googleId: text('google_id'),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantUserUnique: uniqueIndex('tenant_members_tenant_user_unique').on(
      table.tenantId,
      table.userId,
    ),
  }),
);

export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  company: text('company'),
  position: text('position'),
  phones: text('phones').array().default([]).notNull(),
  emails: text('emails').array().default([]).notNull(),
  socials: jsonb('socials').default({}).notNull(),
  tags: text('tags').array().default([]).notNull(),
  source: text('source'),
  customFields: jsonb('custom_fields').default({}).notNull(),
  aiScore: integer('ai_score'),
  aiSummary: text('ai_summary'),
  ownerId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pipelines = pgTable('pipelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  stages: jsonb('stages')
    .$type<
      Array<{ id: string; name: string; order: number; probability?: number; color?: string }>
    >()
    .default([])
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  value: integer('value').default(0).notNull(),
  currency: text('currency').default('UAH').notNull(),
  stage: dealStageEnum('stage').default('lead').notNull(),
  probability: integer('probability'),
  expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
  pipelineId: uuid('pipeline_id')
    .notNull()
    .references(() => pipelines.id, { onDelete: 'cascade' }),
  ownerId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  products: jsonb('products')
    .$type<Array<{ name: string; quantity: number; price: number }>>()
    .default([])
    .notNull(),
  aiScore: integer('ai_score'),
  aiNextStep: text('ai_next_step'),
  winReason: text('win_reason'),
  lossReason: text('loss_reason'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contactDeals = pgTable(
  'contact_deals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    contactDealUnique: uniqueIndex('contact_deals_unique').on(table.contactId, table.dealId),
  }),
);

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').default('other').notNull(),
  priority: taskPriorityEnum('priority').default('medium').notNull(),
  status: taskStatusEnum('status').default('todo').notNull(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  recurring: jsonb('recurring').$type<{
    frequency: 'daily' | 'weekly' | 'monthly';
    endDate?: string;
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  type: activityTypeEnum('type').notNull(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  duration: integer('duration'),
  aiExtractedEntities: jsonb('ai_extracted_entities').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  channel: messageChannelEnum('channel').notNull(),
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  attachments: jsonb('attachments')
    .$type<Array<{ type: string; url: string; name?: string }>>()
    .default([])
    .notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  aiSummary: text('ai_summary'),
  aiSentiment: text('ai_sentiment', { enum: ['positive', 'neutral', 'negative'] }),
  aiEntities: jsonb('ai_entities').default({}).notNull(),
  status: text('status', { enum: ['pending', 'sent', 'delivered', 'read', 'failed'] })
    .default('pending')
    .notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============ RELATIONS ============

export const tenantsRelations = relations(tenants, ({ many }) => ({
  members: many(tenantMembers),
  contacts: many(contacts),
  deals: many(deals),
  pipelines: many(pipelines),
  tasks: many(tasks),
  activities: many(activities),
  messages: many(messages),
}));

export const usersRelations = relations(users, ({ many }) => ({
  tenantMembers: many(tenantMembers),
  ownedContacts: many(contacts, { relationName: 'owner' }),
  ownedDeals: many(deals, { relationName: 'owner' }),
  assignedTasks: many(tasks, { relationName: 'assignee' }),
  activities: many(activities),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantMembers.userId],
    references: [users.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contacts.tenantId],
    references: [tenants.id],
  }),
  owner: one(users, {
    fields: [contacts.ownerId],
    references: [users.id],
    relationName: 'owner',
  }),
  deals: many(contactDeals),
  activities: many(activities),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [deals.tenantId],
    references: [tenants.id],
  }),
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  owner: one(users, {
    fields: [deals.ownerId],
    references: [users.id],
    relationName: 'owner',
  }),
  contacts: many(contactDeals),
  activities: many(activities),
  tasks: many(tasks),
}));

// ============ TYPES ============

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Deal = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
export type Pipeline = typeof pipelines.$inferSelect;
export type NewPipeline = typeof pipelines.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
