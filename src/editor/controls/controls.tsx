import type { ChangeEvent } from 'react';
import type { ParamDef } from '../../engine/graph/types';

interface ControlProps {
  def: ParamDef;
  value: unknown;
  onChange(value: unknown): void;
  onFile?(file: File): void;
}

/** Maps ParamDef.kind → small inline control. All use `nodrag` so React Flow doesn't drag the node. */
export function ParamControl({ def, value, onChange, onFile }: ControlProps) {
  switch (def.kind) {
    case 'number':
      return (
        <label className="param nodrag">
          <span>{def.label}</span>
          <input
            type="range"
            min={def.min ?? 0}
            max={def.max ?? 1}
            step={def.step ?? 0.01}
            value={Number(value ?? def.default)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <em>{formatNumber(Number(value ?? def.default))}</em>
        </label>
      );
    case 'string':
      return (
        <label className="param nodrag">
          <span>{def.label}</span>
          <input
            type="text"
            value={String(value ?? def.default)}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      );
    case 'select':
      return (
        <label className="param nodrag">
          <span>{def.label}</span>
          <select value={String(value ?? def.default)} onChange={(e) => onChange(e.target.value)}>
            {(def.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    case 'boolean':
      return (
        <label className="param nodrag">
          <span>{def.label}</span>
          <input
            type="checkbox"
            checked={Boolean(value ?? def.default)}
            onChange={(e) => onChange(e.target.checked)}
          />
        </label>
      );
    case 'color':
      return (
        <label className="param nodrag">
          <span>{def.label}</span>
          <input
            type="color"
            value={String(value ?? def.default)}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      );
    case 'file':
      return (
        <label className="param nodrag">
          <span>{def.label}</span>
          <input
            type="file"
            accept={def.accept}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (file) onFile?.(file);
            }}
          />
          {value ? <em className="filename">{String(value)}</em> : null}
        </label>
      );
  }
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
