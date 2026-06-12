import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { GraphEditor } from './graph/GraphEditor';
import { ViewportPanel } from './panels/ViewportPanel';
import { TopBar } from './panels/TopBar';

export function App() {
  return (
    <div className="app">
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
