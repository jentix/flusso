import { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { GraphEditor } from './graph/GraphEditor';
import { ViewportPanel } from './panels/ViewportPanel';
import { TopBar } from './panels/TopBar';
import { useEditorStore } from './store';

export function App() {
  const fullscreen = useEditorStore((s) => s.fullscreen);

  useEffect(() => {
    if (!fullscreen) return;
    const exit = () => useEditorStore.getState().setFullscreen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit();
    };
    // Browser fires Esc as a fullscreenchange (not keydown) in native fullscreen.
    const onFsChange = () => {
      if (!document.fullscreenElement) exit();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    // Native fullscreen is best-effort; the CSS mode works without it.
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [fullscreen]);

  return (
    <div className={fullscreen ? 'app fullscreen' : 'app'}>
      <TopBar />
      <PanelGroup direction="horizontal" className="main">
        <Panel defaultSize={55} minSize={25}>
          <GraphEditor />
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        <Panel defaultSize={45} minSize={20}>
          <ViewportPanel />
        </Panel>
      </PanelGroup>
    </div>
  );
}
