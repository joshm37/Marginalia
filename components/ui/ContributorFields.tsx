"use client";

import { Plus, X } from "lucide-react";
import { useRef } from "react";

export function ContributorFields({ value, onChange, role }: {
  value: string; onChange: (value: string) => void; role: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const rows = value.split("\n");
  return <div className="contributor-fields" ref={root}>
    {rows.map((name, index) => <div className="contributor-row" key={index}>
      <input aria-label={`${role} ${index + 1}`} value={name} onChange={(event) => {
        const next = [...rows]; next[index] = event.target.value; onChange(next.join("\n"));
      }} />
      {rows.length > 1 && <button type="button" className="contributor-remove" aria-label={`Remove ${role.toLowerCase()} ${index + 1}`} onClick={() => {
        onChange(rows.filter((_, i) => i !== index).join("\n"));
        requestAnimationFrame(() => root.current?.querySelectorAll("input")[Math.max(0, index - 1)]?.focus());
      }}><X size={14} /></button>}
    </div>)}
    <button type="button" className="contributor-add" onClick={() => {
      onChange(`${value}\n`);
      requestAnimationFrame(() => root.current?.querySelectorAll("input")[rows.length]?.focus());
    }}><Plus size={13} /> Add {role.toLowerCase()}</button>
  </div>;
}
