import './style.css';
import { Extable } from '@extable/react';
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Mode = 'html' | 'canvas';
type UserMode = 'single' | 'multi';

const sampleConfig = {
  data: { rows: [] },
  schema: { columns: [] },
  view: {}
};

export function App() {
  const [mode, setMode] = useState<Mode>('html');
  const [userMode, setUserMode] = useState<UserMode>('single');

  const options = useMemo(
    () => ({ renderMode: mode, editMode: userMode === 'single' ? 'direct' : 'commit', lockMode: 'none' as const }),
    [mode, userMode]
  );

  return (
    <main>
      <h1>Extable Demo (React)</h1>
      <section className="controls">
        <div>
          <h2>Render Mode</h2>
          <label>
            <input checked={mode === 'html'} name="mode" type="radio" value="html" onChange={() => setMode('html')} />
            HTML
          </label>
          <label>
            <input checked={mode === 'canvas'} name="mode" type="radio" value="canvas" onChange={() => setMode('canvas')} />
            Canvas
          </label>
        </div>
        <div>
          <h2>User Mode</h2>
          <label>
            <input
              checked={userMode === 'single'}
              name="user-mode"
              type="radio"
              value="single"
              onChange={() => setUserMode('single')}
            />
            Single
          </label>
          <label>
            <input
              checked={userMode === 'multi'}
              name="user-mode"
              type="radio"
              value="multi"
              onChange={() => setUserMode('multi')}
            />
            Multi
          </label>
        </div>
      </section>
      <section>
        <h2>Wrapper Mount</h2>
        <Extable config={sampleConfig} options={options} />
      </section>
      <section>
        <h2>State Preview</h2>
        <pre>{JSON.stringify({ mode, userMode }, null, 2)}</pre>
      </section>
    </main>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

export default App;
