import type { PortTypeId } from './types';

/** from-type → accepted to-types. Exact match by default; implicit casts listed explicitly. */
const COMPAT: Record<PortTypeId, PortTypeId[]> = {
  number: ['number'],
  vector3: ['vector3'],
  color: ['color'],
  string: ['string'],
  geometry: ['geometry'],
  texture: ['texture'],
  audio: ['audio'],
  spectrum: ['spectrum'],
  path: ['path'],
  transforms: ['transforms'],
  sceneObject: ['sceneObject'],
};

export function canConnect(from: PortTypeId, to: PortTypeId): boolean {
  return COMPAT[from]?.includes(to) ?? false;
}

export const PORT_TYPE_COLORS: Record<PortTypeId, string> = {
  number: '#8ab4f8',
  vector3: '#b388ff',
  color: '#f48fb1',
  string: '#ffcc80',
  geometry: '#80cbc4',
  texture: '#ce93d8',
  audio: '#ef9a9a',
  spectrum: '#ff7043',
  path: '#aed581',
  transforms: '#fff176',
  sceneObject: '#4dd0e1',
};
