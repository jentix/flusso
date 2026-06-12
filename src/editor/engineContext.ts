import { createContext, useContext } from 'react';
import type { Engine } from '../engine/engine';

export const EngineContext = createContext<Engine | null>(null);

export function useEngine(): Engine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('EngineContext not provided');
  return engine;
}
