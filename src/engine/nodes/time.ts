import { registerNode } from '../graph/registry';

registerNode({
  type: 'time',
  label: 'Time',
  category: 'input',
  inputs: [],
  outputs: [{ id: 't', type: 'number', label: 't' }],
  params: [{ id: 'speed', kind: 'number', label: 'Speed', default: 1, min: 0, max: 10, step: 0.1 }],
  hot: true,
  compute({ outputs, params, ctx }) {
    outputs.t = ctx.frame.time * (params.speed as number);
  },
});
