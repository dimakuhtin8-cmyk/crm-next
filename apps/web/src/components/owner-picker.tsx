'use client';

import { useEffect, useState } from 'react';

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
      .catch(() => {});
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
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Не призначено</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.email}
          </option>
        ))}
      </select>
    </div>
  );
}
