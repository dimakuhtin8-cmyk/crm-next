// Re-export types from database (Drizzle)
export type {
  Tenant,
  User,
  Contact,
  Deal,
  Pipeline,
  Task,
  Activity,
  Message,
  NewTenant,
  NewUser,
  NewContact,
  NewDeal,
  NewPipeline,
  NewTask,
  NewActivity,
  NewMessage,
} from '@crm-next/database';

// Re-export enums from database
export {
  userRoleEnum,
  planEnum,
  dealStageEnum,
  taskStatusEnum,
  taskPriorityEnum,
  activityTypeEnum,
  messageChannelEnum,
} from '@crm-next/database';

// ============ ZOD SCHEMAS (for API validation) ============

import { z } from 'zod';

// Contact schemas
export const ContactCreateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  position: z.string().max(100).optional(),
  phones: z.array(z.string()).default([]),
  emails: z.array(z.string().email()).default([]),
  socials: z.record(z.string()).default({}),
  tags: z.array(z.string()).default([]),
  source: z.string().max(50).optional(),
});

export const ContactUpdateSchema = ContactCreateSchema.partial();

// Deal schemas
export const DealCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  value: z.number().min(0).default(0),
  currency: z.string().length(3).default('UAH'),
  stage: z.string().default('lead'),
  pipelineId: z.string().min(1),
  contactIds: z.array(z.string()).default([]),
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().min(1).default(1),
        price: z.number().min(0),
      }),
    )
    .default([]),
});

export const DealUpdateSchema = DealCreateSchema.partial();

// Task schemas
export const TaskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(['call', 'email', 'meeting', 'follow_up', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

export const TaskUpdateSchema = TaskCreateSchema.partial().extend({
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
});

// Pipeline schemas
export const PipelineCreateSchema = z.object({
  name: z.string().min(1).max(100),
  stages: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100),
      order: z.number().min(0),
      probability: z.number().min(0).max(100).optional(),
      color: z.string().optional(),
    }),
  ),
});

// Activity schemas
export const ActivityCreateSchema = z.object({
  type: z.enum(['call', 'email', 'message', 'meeting', 'note', 'task']),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
  content: z.string().min(1).max(10000),
  duration: z.number().min(0).optional(),
});

// Message schemas
export const MessageCreateSchema = z.object({
  channel: z.enum(['telegram', 'whatsapp', 'instagram', 'email', 'sms']),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  content: z.string().min(1).max(10000),
  attachments: z
    .array(
      z.object({
        type: z.string(),
        url: z.string().url(),
        name: z.string().optional(),
      }),
    )
    .default([]),
});

// Auth schemas
export const AuthRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
});

export const AuthLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ============ ZOD TYPES ============

export type ContactCreate = z.infer<typeof ContactCreateSchema>;
export type ContactUpdate = z.infer<typeof ContactUpdateSchema>;
export type DealCreate = z.infer<typeof DealCreateSchema>;
export type DealUpdate = z.infer<typeof DealUpdateSchema>;
export type TaskCreate = z.infer<typeof TaskCreateSchema>;
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;
export type PipelineCreate = z.infer<typeof PipelineCreateSchema>;
export type ActivityCreate = z.infer<typeof ActivityCreateSchema>;
export type MessageCreate = z.infer<typeof MessageCreateSchema>;
export type AuthRegister = z.infer<typeof AuthRegisterSchema>;
export type AuthLogin = z.infer<typeof AuthLoginSchema>;
