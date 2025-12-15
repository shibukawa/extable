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
    <div>
      <h2>Actions</h2>
      <button id="commit-btn" style="display:none;" disabled>Commit Pending</button>
      <div id="commit-state" class="commit-state"></div>
    </div>
    <div>
      <h2>Style</h2>
      <div class="toolbar">
        <button id="style-bold" class="tool-btn" title="Bold"><strong>B</strong></button>
        <button id="style-italic" class="tool-btn" title="Italic"><em>I</em></button>
        <button id="style-underline" class="tool-btn" title="Underline"><span style="text-decoration: underline;">U</span></button>
        <button id="style-strike" class="tool-btn" title="Strikethrough"><span style="text-decoration: line-through;">S</span></button>
        <label class="color-label">Text <input id="style-text-color" type="color" /></label>
        <label class="color-label">Bg <input id="style-bg-color" type="color" /></label>
        <button id="style-clear" class="tool-btn" title="Clear style">Clear</button>
      </div>
    </div>
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
  let unsubscribeTable: (() => void) | null = null;
  let unsubscribeSelection: (() => void) | null = null;
  let lastSelection: any = null;

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
    unsubscribeTable?.();
    unsubscribeTable = null;
    unsubscribeSelection?.();
    unsubscribeSelection = null;
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

    const commitState = document.getElementById('commit-state');
    unsubscribeTable = core.subscribeTableState((next) => {
      if (commitBtn) {
        commitBtn.toggleAttribute('disabled', !next.canCommit);
        if (options.editMode !== 'commit') commitBtn.setAttribute('disabled', 'true');
      }
      if (commitState) {
        commitState.textContent = `pending=${next.pendingCommandCount} cells=${next.pendingCellCount} undo=${next.undoRedo.canUndo ? '1' : '0'} redo=${next.undoRedo.canRedo ? '1' : '0'} mode=${next.renderMode}`;
      }
    });

    const updateStyleButtons = (snap: any) => {
      const setState = (id: string, state: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('active', state === 'on');
        el.classList.toggle('mixed', state === 'mixed');
        el.toggleAttribute('disabled', !snap.canStyle);
      };
      setState('style-bold', snap.styleState.bold);
      setState('style-italic', snap.styleState.italic);
      setState('style-underline', snap.styleState.underline);
      setState('style-strike', snap.styleState.strike);
      const textColor = document.getElementById('style-text-color') as HTMLInputElement | null;
      const bgColor = document.getElementById('style-bg-color') as HTMLInputElement | null;
      if (textColor) textColor.toggleAttribute('disabled', !snap.canStyle);
      if (bgColor) bgColor.toggleAttribute('disabled', !snap.canStyle);
    };

    unsubscribeSelection = core.subscribeSelection((next) => {
      lastSelection = next;
      updateStyleButtons(next);
    });

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

  const toggleFromSelection = (prop: 'bold' | 'italic' | 'underline' | 'strike') => {
    if (!core || !lastSelection) return;
    const current = lastSelection.styleState?.[prop];
    const nextVal = current === 'on' ? false : true;
    core.applyStyleToSelection({ [prop]: nextVal } as any);
  };

  document.getElementById('style-bold')?.addEventListener('click', () => toggleFromSelection('bold'));
  document.getElementById('style-italic')?.addEventListener('click', () => toggleFromSelection('italic'));
  document.getElementById('style-underline')?.addEventListener('click', () => toggleFromSelection('underline'));
  document.getElementById('style-strike')?.addEventListener('click', () => toggleFromSelection('strike'));

  const textColor = document.getElementById('style-text-color') as HTMLInputElement | null;
  textColor?.addEventListener('input', () => {
    if (!core || !lastSelection) return;
    core.applyStyleToSelection({ textColor: textColor.value });
  });
  const bgColor = document.getElementById('style-bg-color') as HTMLInputElement | null;
  bgColor?.addEventListener('input', () => {
    if (!core || !lastSelection) return;
    core.applyStyleToSelection({ background: bgColor.value });
  });
  document.getElementById('style-clear')?.addEventListener('click', () => {
    if (!core || !lastSelection) return;
    core.applyStyleToSelection({
      background: undefined,
      textColor: undefined,
      bold: false,
      italic: false,
      underline: false,
      strike: false
    } as any);
  });
}

main();
