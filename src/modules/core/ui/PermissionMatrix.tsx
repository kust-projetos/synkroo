'use client';
import type { PermissionGroup } from '@/core/rbac/grouped-catalog';

interface Props {
  groups: PermissionGroup[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function PermissionMatrix({ groups, selected, onChange }: Props) {
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };
  const toggleModule = (g: PermissionGroup) => {
    const next = new Set(selected);
    const allOn = g.permissions.every((p) => next.has(p.key));
    for (const p of g.permissions) {
      if (allOn) {
        next.delete(p.key);
      } else {
        next.add(p.key);
      }
    }
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <fieldset key={g.module} className="rounded-lg border p-3">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              aria-label={g.moduleLabel}
              checked={g.permissions.every((p) => selected.has(p.key))}
              onChange={() => toggleModule(g)}
            />
            {g.moduleLabel}
          </label>
          <div className="mt-2 grid gap-1 pl-6">
            {g.permissions.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={p.label}
                  checked={selected.has(p.key)}
                  onChange={() => toggle(p.key)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
