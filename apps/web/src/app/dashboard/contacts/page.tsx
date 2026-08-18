'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  EmptyState,
} from '@/components/ui';

const mockContacts = [
  {
    id: '1',
    firstName: 'Іван',
    lastName: 'Петренко',
    company: 'ТОВ "Будівельник"',
    position: 'Директор',
    email: 'ivan@example.com',
    phone: '+380 67 123 4567',
  },
  {
    id: '2',
    firstName: 'Марія',
    lastName: 'Коваленко',
    company: 'ФОП Коваленко',
    position: 'Власник',
    email: 'maria@example.com',
    phone: '+380 50 987 6543',
  },
  {
    id: '3',
    firstName: 'Олександр',
    lastName: 'Шевченко',
    company: 'IT Компанія',
    position: 'CTO',
    email: 'oleksandr@example.com',
    phone: '+380 63 555 1234',
  },
];

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filteredContacts = mockContacts.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Контакти</h1>
          <p className="text-muted-foreground">Управління базою контактів</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Додати контакт
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Новий контакт</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Ім'я" placeholder="Іван" />
              <Input label="Прізвище" placeholder="Петренко" />
              <Input label="Компанія" placeholder='ТОВ "Компанія"' />
              <Input label="Посада" placeholder="Директор" />
              <Input label="Email" type="email" placeholder="email@example.com" />
              <Input label="Телефон" placeholder="+380 67 123 4567" />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button">Зберегти</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Скасувати
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Пошук контактів..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Badge variant="secondary">{filteredContacts.length} контактів</Badge>
      </div>

      {filteredContacts.length === 0 ? (
        <Card>
          <EmptyState
            icon={
              <svg
                className="h-12 w-12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            }
            title="Контакти не знайдені"
            description="Спробуйте змінити пошуковий запит або додайте новий контакт"
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {contact.firstName[0]}
                    {contact.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {contact.company} • {contact.position}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm">{contact.email}</p>
                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                  </div>
                  <Link href={`/dashboard/contacts/${contact.id}`}>
                    <Button variant="ghost" size="sm">
                      Відкрити
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
