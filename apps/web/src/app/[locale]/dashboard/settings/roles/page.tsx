'use client';

import { Shield, Users, Crown, Eye, Loader2, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Table,
} from '@/components/ui';
import { ROLE_HIERARCHY, PERMISSION_CATEGORIES, type TenantRole } from '@/lib/rbac';

/** Демонстраційне локальне збереження правок матриці (серверна RBAC — незмінна) */
const MATRIX_STORAGE_PREFIX = 'roles-matrix:';

function loadMatrixOverrides(role: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MATRIX_STORAGE_PREFIX + role);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

const ROLE_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode; description: string }
> = {
  owner: {
    label: 'team.owner',
    color: 'bg-primary/10 text-primary',
    icon: <Crown className="w-4 h-4" />,
    description: 'settings.roleOwnerDescription',
  },
  admin: {
    label: 'team.admin',
    color: 'bg-info/10 text-info',
    icon: <Shield className="w-4 h-4" />,
    description: 'settings.roleAdminDescription',
  },
  member: {
    label: 'settings.roleManager',
    color: 'bg-success/10 text-success',
    icon: <Users className="w-4 h-4" />,
    description: 'settings.roleManagerDescription',
  },
  viewer: {
    label: 'settings.roleViewer',
    color: 'bg-secondary text-foreground-muted',
    icon: <Eye className="w-4 h-4" />,
    description: 'settings.roleViewerDescription',
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
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tRoot = useTranslations();
  const [selectedRole, setSelectedRole] = useState<string>('member');
  // Локальні правки матриці (демонстраційні — рольову модель визначає сервер)
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() =>
    loadMatrixOverrides('member'),
  );
  const [saving, setSaving] = useState(false);

  const hasChanges = Object.keys(overrides).length > 0;

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
    setOverrides(loadMatrixOverrides(key));
  };

  const handleSaveMatrix = async () => {
    setSaving(true);
    try {
      // імітація мережевого запиту — збереження локальне (демонстраційне)
      await new Promise((resolve) => setTimeout(resolve, 400));
      window.localStorage.setItem(MATRIX_STORAGE_PREFIX + selectedRole, JSON.stringify(overrides));
      toast.success(t('matrixSaved'), {
        description: t('matrixSavedDescription', {
          role: tRoot(ROLE_CONFIG[selectedRole]?.label ?? ''),
        }),
      });
    } catch {
      toast.error(t('matrixSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetMatrix = () => {
    setOverrides({});
    try {
      window.localStorage.removeItem(MATRIX_STORAGE_PREFIX + selectedRole);
    } catch {
      // localStorage недоступний — правки скидаються лише в стані
    }
    toast.success(t('matrixReset'));
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
      aria-label={t('matrixCellAria', { module: row.module, action })}
    />
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← {tCommon('back')}
        </Link>
        <h1 className="text-2xl font-bold">{t('rolesPageTitle')}</h1>
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
              <h3 className="font-semibold text-sm">{tRoot(config.label)}</h3>
              <p className="text-xs text-foreground-muted mt-1">{tRoot(config.description)}</p>
              <p className="text-xs text-foreground-muted mt-2">
                {t('roleLevel', { level: ROLE_HIERARCHY[key as TenantRole] })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission Matrix */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>
            {t('matrixTitle', { role: tRoot(ROLE_CONFIG[selectedRole]?.label ?? '') })}
          </CardTitle>
          <CardDescription>
            {t('matrixDescription', { role: tRoot(ROLE_CONFIG[selectedRole]?.label ?? '') })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table<MatrixRow>
            data={buildRows()}
            columns={[
              {
                key: 'module',
                header: t('matrixColumnModule'),
                render: (row) => <span className="font-medium">{row.module}</span>,
              },
              { key: 'read', header: t('matrixColumnRead'), render: renderCheckbox('read') },
              { key: 'write', header: t('matrixColumnWrite'), render: renderCheckbox('write') },
              { key: 'delete', header: t('matrixColumnDelete'), render: renderCheckbox('delete') },
            ]}
            emptyMessage={t('matrixEmpty')}
          />
          <div className="flex items-center justify-end gap-2">
            {hasChanges && (
              <Button variant="outline" size="sm" onClick={handleResetMatrix} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('resetEdits')}
              </Button>
            )}
            <Button size="sm" onClick={handleSaveMatrix} disabled={!hasChanges || saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? t('saving') : t('saveMatrix')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-warning/20 bg-warning/5 shadow-sm rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-warning mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning">{t('customRolesTitle')}</p>
              <p className="text-xs text-warning mt-1">{t('customRolesDescription')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
