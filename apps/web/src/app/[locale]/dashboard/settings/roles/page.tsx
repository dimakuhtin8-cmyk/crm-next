'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield, Check, X, Users, Crown, Eye, UserPlus, Loader2,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { ROLE_HIERARCHY, PERMISSION_CATEGORIES, type TenantRole } from '@/lib/rbac';

interface Member {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  owner: { label: 'Власник', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300', icon: <Crown className="w-4 h-4" />, description: 'Повний доступ до всього' },
  admin: { label: 'Адміністратор', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', icon: <Shield className="w-4 h-4" />, description: 'Керування учасниками та налаштуваннями' },
  member: { label: 'Менеджер', color: 'bg-green-500/10 text-green-700 dark:text-green-300', icon: <Users className="w-4 h-4" />, description: 'Створення та редагування власних даних' },
  viewer: { label: 'Глядач', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400', icon: <Eye className="w-4 h-4" />, description: 'Тільки перегляд даних' },
};

export default function RolesSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [selectedRole, setSelectedRole] = useState<string>('member');

  useEffect(() => {
    // Load current user's role from tenant members
    fetch('/api/ai/usage', { credentials: 'include' })
      .then(() => {})
      .catch(() => {});

    // For now, show role info statically
    setLoading(false);
  }, []);

  const rolePermissions: Record<string, string[]> = {
    owner: PERMISSION_CATEGORIES.flatMap(c => c.permissions),
    admin: PERMISSION_CATEGORIES.filter(c => !['Аудит'].includes(c.name)).flatMap(c => c.permissions),
    member: ['contact:create', 'contact:read', 'contact:update', 'deal:create', 'deal:read', 'deal:update', 'task:create', 'task:read', 'task:update', 'activity:create', 'activity:read', 'pipeline:read', 'analytics:read', 'settings:read'],
    viewer: ['contact:read', 'deal:read', 'task:read', 'activity:read', 'pipeline:read', 'analytics:read', 'settings:read'],
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">← Назад</Link>
        <h1 className="text-2xl font-bold">Ролі та права доступу</h1>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(ROLE_CONFIG).map(([key, config]) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedRole === key ? 'border-primary ring-1 ring-primary/20' : ''
            }`}
            onClick={() => setSelectedRole(key)}
          >
            <CardContent className="p-4 text-center">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2 ${config.color}`}>
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
      <Card>
        <CardHeader>
          <CardTitle>Матриця прав: {ROLE_CONFIG[selectedRole]?.label}</CardTitle>
          <CardDescription>
            Права доступу для ролі "{ROLE_CONFIG[selectedRole]?.label}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PERMISSION_CATEGORIES.map((category) => {
              const categoryPerms = rolePermissions[selectedRole] || [];
              return (
                <div key={category.name}>
                  <h4 className="text-sm font-medium text-foreground-muted mb-2">{category.name}</h4>
                  <div className="flex flex-wrap gap-2">
                    {category.permissions.map((perm) => {
                      const hasPerm = categoryPerms.includes(perm);
                      return (
                        <span
                          key={perm}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            hasPerm
                              ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                              : 'bg-red-500/10 text-red-700 dark:text-red-300 line-through opacity-50'
                          }`}
                        >
                          {hasPerm ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {perm}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Кастомні ролі
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Наразі підтримуються 4 стандартні ролі. Кастомні ролі з гнучкою матрицею прав
                будуть доступні у наступних оновленнях.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
