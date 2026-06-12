import { registry, type NodeCategory } from '../../engine/graph/registry';

const CATEGORY_ORDER: NodeCategory[] = ['input', 'audio', 'geometry', 'math', 'output'];

interface PaletteProps {
  onAdd(type: string): void;
}

/** Node palette derived entirely from the registry — zero code per new node. */
export function Palette({ onAdd }: PaletteProps) {
  const byCategory = new Map<NodeCategory, string[]>();
  for (const def of registry.values()) {
    const list = byCategory.get(def.category) ?? [];
    list.push(def.type);
    byCategory.set(def.category, list);
  }

  return (
    <div className="palette">
      <h3>Nodes</h3>
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => (
        <div key={cat} className="palette-category">
          <h4>{cat}</h4>
          {byCategory.get(cat)!.map((type) => (
            <button key={type} onClick={() => onAdd(type)}>
              {registry.get(type)!.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
