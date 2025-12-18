import type {
  CoreOptions,
  EditMode,
  LockMode,
  NullableData,
  Schema,
  SelectionChangeReason,
  SelectionSnapshot,
  TableState,
  View,
  FindReplaceMode,
} from "@extable/core";
import { ExtableCore } from "@extable/core";
import type { PropType } from "vue";
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from "vue";

type CoreApi<T extends object, R extends object = T> = Pick<
  ExtableCore<T, R>,
  | "setData"
  | "setView"
  | "showSearchPanel"
  | "hideSearchPanel"
  | "toggleSearchPanel"
  | "openFindReplaceDialog"
  | "closeFindReplaceDialog"
  | "getData"
  | "getRawData"
  | "getSchema"
  | "getView"
  | "getCell"
  | "getDisplayValue"
  | "getCellPending"
  | "getRow"
  | "getRowData"
  | "getTableData"
  | "getColumnData"
  | "getPending"
  | "getPendingRowIds"
  | "hasPendingChanges"
  | "getPendingCellCount"
  | "getRowIndex"
  | "getColumnIndex"
  | "getAllRows"
  | "listRows"
  | "setCellValue"
  | "setValueToSelection"
  | "insertRow"
  | "deleteRow"
  | "undo"
  | "redo"
  | "getUndoRedoHistory"
  | "commit"
  | "subscribeTableState"
  | "subscribeSelection"
  | "getSelectionSnapshot"
>;

export type ExtableVueHandle<T extends Record<string, unknown> = Record<string, unknown>, R extends object = T> = CoreApi<
  T,
  R
> & {
  destroy(): void;
};

export const Extable = defineComponent({
  name: "Extable",
  inheritAttrs: true,
  props: {
    schema: {
      type: Object as PropType<Schema<any>>,
      required: true,
    },
    defaultData: {
      type: Array as PropType<NullableData>,
      required: false,
      default: null,
    },
    defaultView: {
      type: Object as PropType<View>,
      required: true,
    },
    options: {
      type: Object as PropType<CoreOptions>,
      required: false,
    },
  },
  emits: {
    tableState: (_next: TableState, _prev: TableState | null) => true,
    cellEvent: (
      _next: SelectionSnapshot,
      _prev: SelectionSnapshot | null,
      _reason: SelectionChangeReason,
    ) => true,
  },
  setup(props, { attrs, emit, expose }) {
    const root = ref<HTMLElement | null>(null);
    let core: ExtableCore | null = null;
    let unsubTable: (() => void) | null = null;
    let unsubSel: (() => void) | null = null;
    const initialDefaultDataWasNull = props.defaultData === null;
    let consumedDefaultDataLoad = false;
    const initialSchema = props.schema;
    const initialView = props.defaultView;
    const emptySelectionSnapshot: SelectionSnapshot = {
      ranges: [],
      activeRowIndex: null,
      activeRowKey: null,
      activeColumnIndex: null,
      activeColumnKey: null,
      activeValueRaw: undefined,
      activeValueDisplay: "",
      activeValueType: null,
      diagnostic: null,
      styles: { columnStyle: {}, cellStyle: {}, resolved: {} },
    };

    onMounted(() => {
      if (!root.value) return;
      core = new ExtableCore({
        root: root.value,
        schema: props.schema,
        defaultData: props.defaultData,
        defaultView: props.defaultView,
        options: props.options,
      });
      unsubTable = core.subscribeTableState((next, prev) => emit("tableState", next, prev));
      unsubSel = core.subscribeSelection((next, prev, reason) =>
        emit("cellEvent", next, prev, reason),
      );
    });

    onBeforeUnmount(() => {
      unsubSel?.();
      unsubTable?.();
      unsubSel = null;
      unsubTable = null;
      core?.destroy();
      core = null;
    });

    watch(
      () => props.defaultData,
      (next, prev) => {
        if (!core) return;
        if (!initialDefaultDataWasNull) return;
        if (consumedDefaultDataLoad) return;
        if (next !== null) {
          core.setData(next);
          consumedDefaultDataLoad = true;
        }
      },
    );

    const handle: ExtableVueHandle = {
      destroy: () => {
        core?.destroy();
        core = null;
      },
      setData: (data) => core?.setData(data),
      setView: (view) => core?.setView(view),
      showSearchPanel: (mode?: FindReplaceMode) => core?.showSearchPanel(mode),
      hideSearchPanel: () => core?.hideSearchPanel(),
      toggleSearchPanel: (mode?: FindReplaceMode) => core?.toggleSearchPanel(mode),
      openFindReplaceDialog: (mode?: FindReplaceMode) => core?.openFindReplaceDialog(mode),
      closeFindReplaceDialog: () => core?.closeFindReplaceDialog(),
      getData: () => core?.getData() ?? [],
      getRawData: () => core?.getRawData() ?? [],
      getSchema: () => core?.getSchema() ?? initialSchema,
      getView: () => core?.getView() ?? initialView,
      getCell: (rowId: string, colKey: any) => core?.getCell(rowId, colKey) ?? null,
      getDisplayValue: (row: any, colKey: any) => core?.getDisplayValue(row, colKey) ?? "",
      getCellPending: (row: any, colKey: any) => core?.getCellPending(row, colKey) ?? false,
      getRow: (row: any) => core?.getRow(row) ?? null,
      getRowData: (row: any) => core?.getRowData(row) ?? null,
      getTableData: () => core?.getTableData() ?? [],
      getColumnData: (colKey: any) => core?.getColumnData(colKey) ?? [],
      getPending: () => core?.getPending() ?? new Map(),
      getPendingRowIds: () => core?.getPendingRowIds() ?? [],
      hasPendingChanges: () => core?.hasPendingChanges() ?? false,
      getPendingCellCount: () => core?.getPendingCellCount() ?? 0,
      getRowIndex: (rowId: string) => core?.getRowIndex(rowId) ?? -1,
      getColumnIndex: (colKey: string) => core?.getColumnIndex(colKey) ?? -1,
      getAllRows: () => core?.getAllRows() ?? [],
      listRows: () => core?.listRows() ?? [],
      setCellValue: (row: any, colKey: any, next: any) =>
        core?.setCellValue(row as never, colKey as never, next as never),
      setValueToSelection: (next: any) => core?.setValueToSelection(next),
      insertRow: (rowData: any, pos?: any) => core?.insertRow(rowData, pos) ?? null,
      deleteRow: (row: any) => core?.deleteRow(row) ?? false,
      undo: () => core?.undo(),
      redo: () => core?.redo(),
      getUndoRedoHistory: () => core?.getUndoRedoHistory() ?? { undo: [], redo: [] },
      commit: () => core?.commit() ?? Promise.resolve([]),
      subscribeTableState: (listener: any) => core?.subscribeTableState(listener) ?? (() => false),
      subscribeSelection: (listener: any) => core?.subscribeSelection(listener) ?? (() => false),
      getSelectionSnapshot: () => core?.getSelectionSnapshot() ?? emptySelectionSnapshot,
    };

    expose(handle);

    return () =>
      h("div", {
        ref: root,
        "data-extable-wrapper": "",
        ...attrs,
        class: ["extable-root", (attrs as unknown as Record<string, unknown>).class],
      });
  },
});

export type {
  CoreOptions,
  EditMode,
  LockMode,
  NullableData,
  Schema,
  SelectionChangeReason,
  SelectionSnapshot,
  TableState,
  View,
};
