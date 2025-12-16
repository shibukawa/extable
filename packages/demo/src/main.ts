import './style.css';
import '@extable/core/style.css';
import { ExtableCore } from '@extable/core';
import type { Command, CoreOptions, DataSet, Schema, ServerAdapter, UserInfo, View } from '@extable/core';
import {
  demoRows,
  demoSchema,
  demoView,
  dataFormatRows,
  dataFormatSchema,
  dataFormatView,
  formulaRows,
  formulaSchema,
  formulaView,
  conditionalStyleRows,
  conditionalStyleSchema,
  conditionalStyleView,
  uniqueCheckRows,
  uniqueCheckSchema,
  uniqueCheckView,
  filterSortRows,
  filterSortSchema,
  filterSortView
} from './data/fixtures';

type Mode = 'html' | 'canvas' | 'auto';
type EditMode = 'direct' | 'commit';
type LockMode = 'none' | 'row';
type DataMode = 'standard' | 'data-format' | 'formula' | 'conditional-style' | 'unique-check' | 'filter-sort';

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
      <label><input type="radio" name="data-mode" value="formula" /> Formula</label>
      <label><input type="radio" name="data-mode" value="conditional-style" /> Conditional Style</label>
      <label><input type="radio" name="data-mode" value="unique-check" /> Unique Check</label>
      <label><input type="radio" name="data-mode" value="filter-sort" /> Filter / Sort</label>
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
        <div class="color-group" aria-label="Text color">
          <span class="color-group-label">Text</span>
          <button id="style-text-apply" class="tool-btn color-apply" type="button" title="Apply last text color">A</button>
          <button id="style-text-pick" class="tool-btn color-pick" type="button" title="Pick text color">
            <span class="color-swatch" id="style-text-swatch"></span>
            <span class="color-pick-caret">▾</span>
          </button>
          <input id="style-text-color" class="color-input-hidden" type="color" />
        </div>
        <div class="color-group" aria-label="Background color">
          <span class="color-group-label">Bg</span>
          <button id="style-bg-apply" class="tool-btn color-apply" type="button" title="Apply last background color">■</button>
          <button id="style-bg-pick" class="tool-btn color-pick" type="button" title="Pick background color">
            <span class="color-swatch" id="style-bg-swatch"></span>
            <span class="color-pick-caret">▾</span>
          </button>
          <input id="style-bg-color" class="color-input-hidden" type="color" value="#ffffff" />
        </div>
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
          <h2>Data Note</h2>
          <pre id="data-note"></pre>
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
  if (dataMode === 'formula') {
    return {
      data: { rows: formulaRows.map((r) => ({ ...r })) },
      schema: formulaSchema,
      view: { ...formulaView }
    };
  }
  if (dataMode === 'conditional-style') {
    return {
      data: { rows: conditionalStyleRows.map((r) => ({ ...r })) },
      schema: conditionalStyleSchema,
      view: { ...conditionalStyleView }
    };
  }
  if (dataMode === 'unique-check') {
    return {
      data: { rows: uniqueCheckRows.map((r) => ({ ...r })) },
      schema: uniqueCheckSchema,
      view: { ...uniqueCheckView }
    };
  }
  if (dataMode === 'filter-sort') {
    return {
      data: { rows: filterSortRows.map((r) => ({ ...r })) },
      schema: filterSortSchema,
      view: { ...filterSortView }
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
  let lastTextColor = '#000000';
  let lastBgColor = '#ffffff';

  const stateEl = document.getElementById('state');
  const dataNoteEl = document.getElementById('data-note');

  const safeFnSource = (fn: unknown) => {
    if (typeof fn !== 'function') return null;
    try {
      return String(fn);
    } catch {
      return '[unavailable]';
    }
  };

  const dataNoteForSchema = (schema: Schema) => {
    const lines: string[] = [];
    const metaRow = schema.columns.find((c: any) => String(c.key) === '__row__');
    if (metaRow?.conditionalStyle) {
      lines.push('Row conditionalStyle (__row__):');
      lines.push(safeFnSource((metaRow as any).conditionalStyle) ?? '');
      lines.push('');
    }

    const cols = schema.columns.filter((c: any) => String(c.key) !== '__row__');
    const formulaCols = cols.filter((c: any) => Boolean((c as any).formula));
    const condCols = cols.filter((c: any) => Boolean((c as any).conditionalStyle));
    const uniqueCols = cols.filter((c: any) => Boolean((c as any).unique));

    if (formulaCols.length) {
      lines.push('Computed columns (formula):');
      for (const c of formulaCols) {
        lines.push(`- ${String((c as any).key)} (${String((c as any).type)}):`);
        lines.push(safeFnSource((c as any).formula) ?? '');
      }
      lines.push('');
    }
    if (condCols.length) {
      lines.push('Conditional styles (conditionalStyle):');
      for (const c of condCols) {
        lines.push(`- ${String((c as any).key)} (${String((c as any).type)}):`);
        lines.push(safeFnSource((c as any).conditionalStyle) ?? '');
      }
      lines.push('');
    }
    if (uniqueCols.length) {
      lines.push('Unique columns (unique: true):');
      for (const c of uniqueCols) {
        lines.push(`- ${String((c as any).key)} (${String((c as any).type)}): duplicates -> validation errors`);
      }
      lines.push('');
    }

    if (!lines.length) return 'No formula/conditionalStyle/unique rules in this dataset.';
    return lines.join('\n');
  };

  const updateDataNote = () => {
    if (!dataNoteEl) return;
    const cfg = currentConfig;
    const header = [
      `dataMode: ${dataMode}`,
      '',
      'Notes:',
      '- formula: (row) => value | [value, Error] (warning) | throw (error)',
      '- conditionalStyle: (row) => StyleDelta | null | Error (warning) | throw (error)',
      '- Warning/Error is shown as a corner marker with hover message.',
      '',
      'Sources:',
      ''
    ].join('\n');
    dataNoteEl.textContent = header + dataNoteForSchema(cfg.schema);
  };

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
    updateDataNote();
  };

  const rebuildCore = () => {
    core?.destroy();
    unsubscribeTable?.();
    unsubscribeTable = null;
    unsubscribeSelection?.();
    unsubscribeSelection = null;
    const config = cloneConfig(dataMode);
    currentConfig = config;
    updateDataNote();
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
      const textPick = document.getElementById('style-text-pick') as HTMLButtonElement | null;
      const textApply = document.getElementById('style-text-apply') as HTMLButtonElement | null;
      const bgPick = document.getElementById('style-bg-pick') as HTMLButtonElement | null;
      const bgApply = document.getElementById('style-bg-apply') as HTMLButtonElement | null;
      if (textPick) textPick.toggleAttribute('disabled', !snap.canStyle);
      if (textApply) textApply.toggleAttribute('disabled', !snap.canStyle);
      if (bgPick) bgPick.toggleAttribute('disabled', !snap.canStyle);
      if (bgApply) bgApply.toggleAttribute('disabled', !snap.canStyle);
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

  const setSwatch = (id: string, color: string) => {
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el) return;
    el.style.background = color;
  };

  const textColor = document.getElementById('style-text-color') as HTMLInputElement | null;
  const textPick = document.getElementById('style-text-pick') as HTMLButtonElement | null;
  const textApply = document.getElementById('style-text-apply') as HTMLButtonElement | null;
  if (textColor) textColor.value = lastTextColor;
  setSwatch('style-text-swatch', lastTextColor);
  textPick?.addEventListener('click', (e) => {
    e.preventDefault();
    textColor?.click();
  });
  textApply?.addEventListener('click', () => {
    if (!core || !lastSelection) return;
    core.applyStyleToSelection({ textColor: lastTextColor });
  });
  textColor?.addEventListener('input', () => {
    if (!core || !lastSelection || !textColor) return;
    lastTextColor = textColor.value;
    setSwatch('style-text-swatch', lastTextColor);
    core.applyStyleToSelection({ textColor: lastTextColor });
  });

  const bgColor = document.getElementById('style-bg-color') as HTMLInputElement | null;
  const bgPick = document.getElementById('style-bg-pick') as HTMLButtonElement | null;
  const bgApply = document.getElementById('style-bg-apply') as HTMLButtonElement | null;
  if (bgColor) bgColor.value = lastBgColor;
  setSwatch('style-bg-swatch', lastBgColor);
  bgPick?.addEventListener('click', (e) => {
    e.preventDefault();
    bgColor?.click();
  });
  bgApply?.addEventListener('click', () => {
    if (!core || !lastSelection) return;
    core.applyStyleToSelection({ background: lastBgColor });
  });
  bgColor?.addEventListener('input', () => {
    if (!core || !lastSelection || !bgColor) return;
    lastBgColor = bgColor.value;
    setSwatch('style-bg-swatch', lastBgColor);
    core.applyStyleToSelection({ background: lastBgColor });
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
