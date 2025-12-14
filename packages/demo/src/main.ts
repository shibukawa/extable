import './style.css';
import '@extable/core/style.css';
import { ExtableCore } from '@extable/core';
import type { Command, CoreOptions, DataSet, Schema, ServerAdapter, UserInfo, View } from '@extable/core';
import { demoRows, demoSchema, demoView, dataFormatRows, dataFormatSchema, dataFormatView } from './data/fixtures';

type Mode = 'html' | 'canvas' | 'auto';
type EditMode = 'direct' | 'commit';
type LockMode = 'none' | 'row';
type DataMode = 'standard' | 'data-format';

const app = document.querySelector<HTMLDivElement>('#app');
const tableRootId = 'table-root';

const user: UserInfo = { id: 'demo-user', name: 'Demo User' };

let currentConfig: { data: DataSet; view: View; schema: Schema } = {
  data: { rows: demoRows.map((r) => ({ ...r })) },
  view: { ...demoView },
  schema: demoSchema
};

const serverStub: ServerAdapter = {
  async fetchInitial() {
    return { ...currentConfig, user };
  },
  async lockRow(rowId) {
    console.log('lockRow', rowId);
  },
  async unlockRows(rowIds) {
    console.log('unlockRows', rowIds);
  },
  async commit(commands: Command[]) {
    console.log('commit', commands);
  },
  subscribe(onEvent) {
    return () => {
      console.log('unsubscribe', onEvent);
    };
  }
};

function renderShell() {
  if (!app) return;
  app.innerHTML = `
    <main>
      <h1>Extable Demo</h1>
      <section class="controls">
        <div>
      <h2>Render Mode</h2>
      <label><input type="radio" name="render-mode" value="auto" checked /> Auto</label>
      <label><input type="radio" name="render-mode" value="html" /> HTML</label>
      <label><input type="radio" name="render-mode" value="canvas" /> Canvas</label>
    </div>
        <div>
          <h2>Edit Mode</h2>
          <label><input type="radio" name="edit-mode" value="direct" checked /> Direct</label>
      <label><input type="radio" name="edit-mode" value="commit" /> Commit</label>
    </div>
    <div>
      <h2>Lock Mode</h2>
      <label><input type="radio" name="lock-mode" value="none" checked /> None</label>
      <label><input type="radio" name="lock-mode" value="row" /> Row Lock</label>
    </div>
    <div>
      <h2>Wrap Text</h2>
      <label><input type="checkbox" id="wrap-toggle" checked /> Enable wrap</label>
    </div>
    <div>
      <h2>Data Set</h2>
      <label><input type="radio" name="data-mode" value="standard" checked /> Standard</label>
      <label><input type="radio" name="data-mode" value="data-format" /> Data Format</label>
    </div>
    <button id="commit-btn" style="display:none;">Commit Pending</button>
  </section>
      <section class="layout">
        <div class="table-panel">
          <h2>Table</h2>
          <div class="table-container">
            <div id="${tableRootId}" class="table-root"></div>
          </div>
        </div>
        <div class="state-panel">
          <h2>State Preview</h2>
          <pre id="state"></pre>
        </div>
      </section>
    </main>
  `;
}

function cloneConfig(dataMode: DataMode) {
  if (dataMode === 'data-format') {
    return {
      data: { rows: dataFormatRows.map((r) => ({ ...r })) },
      schema: dataFormatSchema,
      view: { ...dataFormatView }
    };
  }
  return {
    data: { rows: demoRows.map((r) => ({ ...r })) },
    schema: demoSchema,
    view: { ...demoView }
  };
}

function main() {
  if (!app) return;
  renderShell();
  const tableRoot = document.getElementById(tableRootId)!;

  const options: CoreOptions = {
    renderMode: 'auto',
    editMode: 'direct',
    lockMode: 'none',
    server: serverStub,
    user
  };

  let core: ExtableCore | null = null;
  let wrapText = true;
  let dataMode: DataMode = 'standard';

  const stateEl = document.getElementById('state');
  const updateState = () => {
    if (!stateEl) return;
    stateEl.textContent = JSON.stringify(
      {
        renderMode: options.renderMode,
        editMode: options.editMode,
        lockMode: options.lockMode,
        wrapText,
        dataMode
      },
      null,
      2
    );
  };

  const rebuildCore = () => {
    core?.destroy();
    const config = cloneConfig(dataMode);
    currentConfig = config;
    core = new ExtableCore({
      root: tableRoot,
      defaultData: config.data,
      defaultView: { ...config.view, wrapText: config.view.wrapText ?? (wrapText ? {} : {}) },
      schema: config.schema,
      options: { ...options }
    });
    // Expose the latest core instance for demos/e2e.
    (window as any).__extableCore = core;
    const commitBtn = document.getElementById('commit-btn');
    if (commitBtn) {
      commitBtn.style.display = options.editMode === 'commit' ? 'inline-block' : 'none';
    }
    updateState();
  };

  rebuildCore();

  document.querySelectorAll<HTMLInputElement>('input[name="render-mode"]').forEach((input) => {
    input.addEventListener('change', () => {
      options.renderMode = input.value as Mode;
      rebuildCore();
    });
  });

  document.querySelectorAll<HTMLInputElement>('input[name="edit-mode"]').forEach((input) => {
    input.addEventListener('change', () => {
      options.editMode = input.value as EditMode;
      rebuildCore();
    });
  });

  document.querySelectorAll<HTMLInputElement>('input[name="lock-mode"]').forEach((input) => {
    input.addEventListener('change', () => {
      options.lockMode = input.value as LockMode;
      rebuildCore();
    });
  });

  const wrapToggle = document.querySelector<HTMLInputElement>('#wrap-toggle');
  wrapToggle?.addEventListener('change', () => {
    wrapText = Boolean(wrapToggle.checked);
    rebuildCore();
  });

  document.querySelectorAll<HTMLInputElement>('input[name="data-mode"]').forEach((input) => {
    input.addEventListener('change', () => {
      dataMode = input.value as DataMode;
      rebuildCore();
    });
  });

  const commitBtn = document.getElementById('commit-btn');
  commitBtn?.addEventListener('click', () => {
    void core?.commit();
  });
}

main();
