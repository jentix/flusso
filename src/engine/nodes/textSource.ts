import { registerNode } from '../graph/registry';

/** Split by grapheme clusters so ZWJ emoji (👨‍👩‍👧) stay whole. */
export function splitGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...seg.segment(text)].map((s) => s.segment).filter((s) => s.trim().length > 0);
  }
  return [...text].filter((s) => s.trim().length > 0);
}

registerNode({
  type: 'textSource',
  label: 'Text',
  category: 'input',
  inputs: [],
  outputs: [{ id: 'text', type: 'string', label: 'Text' }],
  params: [{ id: 'text', kind: 'string', label: 'Text', default: '🔥🎵✨' }],
  compute({ outputs, params }) {
    outputs.text = params.text as string;
  },
});
