import { useEffect, useRef, useState } from 'react';
import { Stage } from '../../engine/render/stage';
import { useEngine } from '../engineContext';

/**
 * Hosts the three.js canvas. React renders this once; the Stage owns the
 * rAF loop. Effect is idempotent (full dispose in cleanup) so StrictMode
 * double-mount doesn't leave two render loops running.
 */
export function ViewportPanel() {
  const engine = useEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const stage = new Stage(canvas);
    engine.attachStage(stage);

    const ro = new ResizeObserver(() => {
      stage.resize(wrap.clientWidth, wrap.clientHeight);
    });
    ro.observe(wrap);
    stage.resize(wrap.clientWidth, wrap.clientHeight);

    const fpsTimer = setInterval(() => setFps(Math.round(stage.fps)), 500);

    return () => {
      clearInterval(fpsTimer);
      ro.disconnect();
      engine.detachStage();
    };
  }, [engine]);

  return (
    <div className="viewport" ref={wrapRef}>
      <canvas ref={canvasRef} />
      <div className="fps">{fps} fps</div>
    </div>
  );
}
