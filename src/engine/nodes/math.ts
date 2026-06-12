import { registerNode } from '../graph/registry';

const OPS: Record<string, (a: number, b: number) => number> = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => (b === 0 ? 0 : a / b),
  sin: (a, b) => Math.sin(a) * b,
  cos: (a, b) => Math.cos(a) * b,
};

registerNode({
  type: 'math',
  label: 'Math',
  category: 'math',
  inputs: [
    { id: 'a', type: 'number', label: 'A', defaultValue: 0 },
    { id: 'b', type: 'number', label: 'B', defaultValue: 1 },
  ],
  outputs: [{ id: 'out', type: 'number', label: 'Out' }],
  params: [
    { id: 'op', kind: 'select', label: 'Op', default: 'sin', options: Object.keys(OPS) },
  ],
  compute({ inputs, outputs, params }) {
    const op = OPS[params.op as string] ?? OPS.add;
    outputs.out = op((inputs.a as number) ?? 0, (inputs.b as number) ?? 1);
  },
});
