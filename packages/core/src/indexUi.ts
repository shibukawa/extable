export type ContextMenuActionDef = { key: string; label?: string; kind?: "sep" };

export function getContextMenuActions(readonlyMode: boolean): ContextMenuActionDef[] {
  if (readonlyMode) {
    return [{ key: "copy", label: "Copy" }];
  }
  return [
    { key: "copy", label: "Copy" },
    { key: "paste", label: "Paste" },
    { key: "sep-top", kind: "sep" },
    { key: "undo", label: "Undo" },
    { key: "redo", label: "Redo" },
    { key: "sep-mid", kind: "sep" },
    { key: "insert-above", label: "Insert row above" },
    { key: "insert-below", label: "Insert row below" },
    { key: "delete-row", label: "Delete row" },
  ];
}

export const FILTER_SORT_SIDEBAR_HTML = `
  <div class="extable-filter-sort-header">
    <div class="extable-filter-sort-row">
      <div class="extable-filter-sort-title" data-extable-fs="title">Sort/Filter</div>
      <button type="button" data-extable-fs="close" class="extable-filter-sort-close">×</button>
    </div>
  </div>
  <div class="extable-filter-sort-body">
    <div class="extable-filter-sort-section extable-filter-sort-section-filter">
      <div class="extable-filter-sort-section-title">Filter</div>
      <div class="extable-filter-sort-actions">
        <label><input type="checkbox" data-extable-fs="col-errors" /> Errors</label>
        <label><input type="checkbox" data-extable-fs="col-warnings" /> Warnings</label>
      </div>
      <input data-extable-fs="search" type="text" placeholder="Search values" />
      <div class="extable-filter-sort-values" data-extable-fs="values"></div>
      <div class="extable-filter-sort-actions" data-align="split">
        <button type="button" data-extable-fs="select-all">Select All</button>
        <button type="button" data-extable-fs="select-none">Select None</button>
        <button type="button" data-extable-fs="apply-filter">Apply</button>
        <button type="button" data-extable-fs="clear-filter">Clear</button>
      </div>
    </div>
    <div class="extable-filter-sort-section extable-filter-sort-section-sort">
      <div class="extable-filter-sort-section-title">Sort</div>
      <div class="extable-filter-sort-actions" data-align="right">
        <button type="button" data-extable-fs="sort-asc">Sort Asc</button>
        <button type="button" data-extable-fs="sort-desc">Sort Desc</button>
        <button type="button" data-extable-fs="clear-sort">Clear Sort</button>
      </div>
    </div>
  </div>
`;
