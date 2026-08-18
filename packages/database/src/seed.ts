import { db } from './connection';
import { tenants, users, contacts, pipelines, deals, tasks } from './schema';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: 'Demo Company',
      domain: 'demo.crm-next.ua',
      plan: 'professional',
    })
    .returning();

  console.log(`✅ Created tenant: ${tenant.name}`);

  // Create demo user
  const [user] = await db
    .insert(users)
    .values({
      firebaseUid: 'demo-firebase-uid',
      email: 'demo@crm-next.ua',
      name: 'Demo User',
    })
    .returning();

  console.log(`✅ Created user: ${user.email}`);

  // Create contacts
  const contactsData = [
    {
      firstName: 'Іван',
      lastName: 'Петренко',
      company: 'ТОВ "Будівельник"',
      position: 'Директор',
      tenantId: tenant.id,
      ownerId: user.id,
    },
    {
      firstName: 'Марія',
      lastName: 'Коваленко',
      company: 'ФОП Коваленко',
      position: 'Власник',
      tenantId: tenant.id,
      ownerId: user.id,
    },
    {
      firstName: 'Олександр',
      lastName: 'Шевченко',
      company: 'IT Компанія',
      position: 'CTO',
      tenantId: tenant.id,
      ownerId: user.id,
    },
  ];

  for (const contact of contactsData) {
    await db.insert(contacts).values(contact);
  }

  console.log(`✅ Created ${contactsData.length} contacts`);

  // Create pipeline
  const [pipeline] = await db
    .insert(pipelines)
    .values({
      tenantId: tenant.id,
      name: 'Стандартні продажі',
      stages: [
        { id: 'lead', name: 'Лід', order: 0, probability: 10, color: '#6366f1' },
        { id: 'qualified', name: 'Кваліфікація', order: 1, probability: 25, color: '#8b5cf6' },
        { id: 'proposal', name: 'КП', order: 2, probability: 50, color: '#f59e0b' },
        { id: 'negotiation', name: 'Переговори', order: 3, probability: 75, color: '#10b981' },
        { id: 'closed_won', name: 'Виграно', order: 4, probability: 100, color: '#22c55e' },
      ],
    })
    .returning();

  console.log(`✅ Created pipeline: ${pipeline.name}`);

  // Create deals
  const dealsData = [
    {
      tenantId: tenant.id,
      title: 'Ремонт офісу 500м²',
      value: 450000,
      currency: 'UAH',
      stage: 'proposal',
      pipelineId: pipeline.id,
      ownerId: user.id,
      probability: 50,
    },
    {
      tenantId: tenant.id,
      title: 'Веб-сайт для компанії',
      value: 120000,
      currency: 'UAH',
      stage: 'negotiation',
      pipelineId: pipeline.id,
      ownerId: user.id,
      probability: 75,
    },
    {
      tenantId: tenant.id,
      title: 'CRM інтеграція',
      value: 80000,
      currency: 'UAH',
      stage: 'lead',
      pipelineId: pipeline.id,
      ownerId: user.id,
      probability: 10,
    },
  ];

  for (const deal of dealsData) {
    await db.insert(deals).values(deal);
  }

  console.log(`✅ Created ${dealsData.length} deals`);

  // Create tasks
  const tasksData = [
    {
      tenantId: tenant.id,
      title: 'Підготовити КП для Петренка',
      type: 'follow_up',
      priority: 'high',
      status: 'todo',
      assigneeId: user.id,
      dueDate: new Date(Date.now() + 86400000),
    },
    {
      tenantId: tenant.id,
      title: 'Дзвонити Коваленко',
      type: 'call',
      priority: 'medium',
      status: 'in_progress',
      assigneeId: user.id,
    },
    {
      tenantId: tenant.id,
      title: 'Відправити контракт',
      type: 'email',
      priority: 'urgent',
      status: 'todo',
      assigneeId: user.id,
      dueDate: new Date(Date.now() + 172800000),
    },
  ];

  for (const task of tasksData) {
    await db.insert(tasks).values(task);
  }

  console.log(`✅ Created ${tasksData.length} tasks`);

  console.log('🎉 Database seeded successfully!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
