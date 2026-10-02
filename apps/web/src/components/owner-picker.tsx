'use client';

import { useEffect, useState } from 'react';

import { QuickSelect } from '@/components/quick-create';

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
}

/** Team members + current user's tenant role. Single /api/team fetch. */
export function useTeam(): { members: TeamMember[]; currentRole: string | null } {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/team', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members || []);
        setCurrentRole(data.currentRole || null);
      })
      .catch(() => {
        // команда/роль: мовчазно, UI ховає owner-контроли без ролі
        console.warn('[owner-picker] team fetch failed');
      });
  }, []);

  return { members, currentRole };
}

interface OwnerPickerProps {
  /** Current ownerId (null = unassigned) */
  value: string | null;
  /** Called with the new ownerId (null = unassign). Caller PUTs it itself. */
  onChange: (ownerId: string | null) => void;
  /** True for admin/owner roles — members get a disabled control + tooltip. */
  canManage: boolean;
  disabledReason?: string;
  label?: string;
}

/**
 * Owner picker for contacts/deals ("Власник").
 * Reuses GET /api/team — the same source as the task "Відповідальний" picker.
 * Backend re-validates admin+ on every write; this control is convenience only.
 */
export function OwnerPicker({
  value,
  onChange,
  canManage,
  disabledReason = 'Призначати власника може лише admin',
  label = 'Власник',
}: OwnerPickerProps) {
  const { members } = useTeam();
  const current = members.find((m) => m.id === value);

  if (!canManage) {
    return (
      <div>
        <p className="text-xs text-foreground-muted mb-1">{label}</p>
        <p
          className="text-sm font-medium text-foreground-muted cursor-not-allowed"
          title={disabledReason}
        >
          {current ? current.name || current.email : 'Не призначено'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <QuickSelect
        value={value || ''}
        onChange={(id) => onChange(id || null)}
        options={[
          { id: '', name: 'Не призначено' },
          ...members.map((m) => ({ id: m.id, name: m.name || m.email || '?' })),
        ]}
        placeholder="Не призначено"
      />
    </div>
  );
}
