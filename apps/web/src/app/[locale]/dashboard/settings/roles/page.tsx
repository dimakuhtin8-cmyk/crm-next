'use client';

import { Shield, Users, Crown, Eye } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Table,
} from '@/components/ui';
import { ROLE_HIERARCHY, PERMISSION_CATEGORIES, type TenantRole } from '@/lib/rbac';

const ROLE_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode; description: string }
> = {
  owner: {
    label: 'Власник',
    color: 'bg-primary/10 text-primary',
    icon: <Crown className="w-4 h-4" />,
    description: 'Повний доступ до всього',
  },
  admin: {
    label: 'Адміністратор',
    color: 'bg-info/10 text-info',
    icon: <Shield className="w-4 h-4" />,
    description: 'Керування учасниками та налаштуваннями',
  },
  member: {
    label: 'Менеджер',
    color: 'bg-success/10 text-success',
    icon: <Users className="w-4 h-4" />,
    description: 'Створення та редагування власних даних',
  },
  viewer: {
    label: 'Глядач',
    color: 'bg-secondary text-foreground-muted',
    icon: <Eye className="w-4 h-4" />,
    description: 'Тільки перегляд даних',
  },
};

type MatrixAction = 'read' | 'write' | 'delete';

const actionOf = (perm: string): MatrixAction => {
  const suffix = perm.split(':')[1];
  if (suffix === 'read') return 'read';
  if (suffix === 'delete' || suffix === 'remove') return 'delete';
  return 'write';
};

type MatrixRow = {
  id: string;
  module: string;
  read: boolean;
  write: boolean;
  delete: boolean;
  hasRead: boolean;
  hasWrite: boolean;
  hasDelete: boolean;
};

export default function RolesSettingsPage() {
  const [selectedRole, setSelectedRole] = useState<string>('member');
  // Локальні правки матриці (демонстраційні — рольову модель визначає сервер)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const rolePermissions: Record<string, string[]> = {
    owner: PERMISSION_CATEGORIES.flatMap((c) => c.permissions),
    admin: PERMISSION_CATEGORIES.filter((c) => !['Аудит'].includes(c.name)).flatMap(
      (c) => c.permissions,
    ),
    member: [
      'contact:create',
      'contact:read',
      'contact:update',
      'deal:create',
      'deal:read',
      'deal:update',
      'task:create',
      'task:read',
      'task:update',
      'activity:create',
      'activity:read',
      'pipeline:read',
      'analytics:read',
      'settings:read',
    ],
    viewer: [
      'contact:read',
      'deal:read',
      'task:read',
      'activity:read',
      'pipeline:read',
      'analytics:read',
      'settings:read',
    ],
  };

  const selectRole = (key: string) => {
    setSelectedRole(key);
    setOverrides({});
  };

  const buildRows = (): MatrixRow[] => {
    const perms = rolePermissions[selectedRole] || [];
    return PERMISSION_CATEGORIES.map((category) => {
      const exists = (action: MatrixAction) =>
        category.permissions.some((p) => actionOf(p) === action);
      const granted = (action: MatrixAction) =>
        category.permissions.some((p) => actionOf(p) === action && perms.includes(p));
      const checked = (action: MatrixAction) =>
        overrides[`${category.name}:${action}`] ?? granted(action);
      return {
        id: category.name,
        module: category.name,
        read: checked('read'),
        write: checked('write'),
        delete: checked('delete'),
        hasRead: exists('read'),
        hasWrite: exists('write'),
        hasDelete: exists('delete'),
      };
    });
  };

  const toggleCell = (row: MatrixRow, action: MatrixAction) => {
    if (action === 'read' && !row.hasRead) return;
    if (action === 'write' && !row.hasWrite) return;
    if (action === 'delete' && !row.hasDelete) return;
    setOverrides((prev) => ({ ...prev, [`${row.id}:${action}`]: !row[action] }));
  };

  const renderCheckbox = (action: MatrixAction) => (row: MatrixRow) => (
    <Checkbox
      checked={row[action]}
      disabled={
        action === 'read' ? !row.hasRead : action === 'write' ? !row.hasWrite : !row.hasDelete
      }
      onCheckedChange={() => toggleCell(row, action)}
      aria-label={`${row.module}: ${action}`}
    />
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold">Ролі та права доступу</h1>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(ROLE_CONFIG).map(([key, config]) => (
          <Card
            key={key}
            className={`bg-card border-border shadow-sm rounded-xl cursor-pointer transition-all hover:shadow-md ${
              selectedRole === key ? 'border-primary ring-1 ring-primary/20' : ''
            }`}
            onClick={() => selectRole(key)}
          >
            <CardContent className="p-4 text-center">
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2 ${config.color}`}
              >
                {config.icon}
              </div>
              <h3 className="font-semibold text-sm">{config.label}</h3>
              <p className="text-xs text-foreground-muted mt-1">{config.description}</p>
              <p className="text-xs text-foreground-muted mt-2">
                Рівень: {ROLE_HIERARCHY[key as TenantRole]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission Matrix */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Матриця прав: {ROLE_CONFIG[selectedRole]?.label}</CardTitle>
          <CardDescription>
            Доступ ролі «{ROLE_CONFIG[selectedRole]?.label}» за модулями: перегляд, запис, видалення
            (позначки можна перемикати — це демонстраційна матриця)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table<MatrixRow>
            data={buildRows()}
            columns={[
              {
                key: 'module',
                header: 'Модуль',
                render: (row) => <span className="font-medium">{row.module}</span>,
              },
              { key: 'read', header: 'Перегляд', render: renderCheckbox('read') },
              { key: 'write', header: 'Запис', render: renderCheckbox('write') },
              { key: 'delete', header: 'Видалення', render: renderCheckbox('delete') },
            ]}
            emptyMessage="Немає модулів"
          />
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-warning/20 bg-warning/5 shadow-sm rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-warning mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning">Кастомні ролі</p>
              <p className="text-xs text-warning mt-1">
                Наразі підтримуються 4 стандартні ролі. Кастомні ролі з гнучкою матрицею прав будуть
                доступні у наступних оновленнях.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
