import {
  callCore,
  callCoreOr,
  callCorePromiseOr,
  ExtableCore,
} from "@extable/core";
import type {
  CommitHandler,
  CoreOptions,
  EditMode,
  LockMode,
  NullableData,
  Schema,
  SelectionChangeReason,
  SelectionSnapshot,
  TableState,
  View,
} from "@extable/core";
import type { PropType } from "vue";
import { defineComponent, getCurrentInstance, h, onBeforeUnmount, onMounted, watch } from "vue";

type CoreApi<T extends object, R extends object = T> = Pick<
  ExtableCore<T, R>,
  | "setData"
  | "setView"
  | "showFilterSortPanel"
  | "hideFilterSortPanel"
  | "toggleFilterSortPanel"
  | "getData"
  | "getRawData"
  | "getSchema"
  | "getView"
  | "getCell"
  | "getDisplayValue"
  | "getCellPending"
  | "getRow"
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

export type ExtableVueHandle<T extends object = Record<string, unknown>, R extends object = T> = CoreApi<
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
      type: Object as PropType<Schema<any, any>>,
      required: true,
    },
    defaultData: {
      type: Array as PropType<NullableData<any>>,
      required: false,
      default: null,
    },
    defaultView: {
      type: Object as PropType<View>,
      required: false,
      default: () => ({} as View),
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
    const instance = getCurrentInstance();
    let core: ExtableCore<Record<string, unknown>> | null = null;
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
      action: null,
      styles: { columnStyle: {}, cellStyle: {}, resolved: {} },
    };

    onMounted(() => {
      const root = instance?.proxy?.$el as HTMLElement | null;
      if (!root) return;
      core = new ExtableCore({
        root,
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
      setData: (data) => {
        callCore(core, (x) => x.setData(data));
      },
      setView: (view) => {
        callCore(core, (x) => x.setView(view));
      },
      showFilterSortPanel: (colKey: string) => {
        callCore(core, (x) => x.showFilterSortPanel(colKey));
      },
      hideFilterSortPanel: () => {
        callCore(core, (x) => x.hideFilterSortPanel());
      },
      toggleFilterSortPanel: (colKey: string) => {
        callCore(core, (x) => x.toggleFilterSortPanel(colKey));
      },
      getData: () => callCoreOr(core, (x) => x.getData(), []),
      getRawData: () => callCoreOr(core, (x) => x.getRawData(), []),
      getSchema: () => callCoreOr(core, (x) => x.getSchema(), initialSchema),
      getView: () => callCoreOr(core, (x) => x.getView(), initialView),
      getCell: (rowId: string, colKey: any) => callCoreOr(core, (x) => x.getCell(rowId, colKey), null),
      getDisplayValue: (row: any, colKey: any) =>
        callCoreOr(core, (x) => x.getDisplayValue(row, colKey), ""),
      getCellPending: (row: any, colKey: any) =>
        callCoreOr(core, (x) => x.getCellPending(row, colKey), false),
      getRow: (row: any) => callCoreOr(core, (x) => x.getRow(row), null),
      getTableData: () => callCoreOr(core, (x) => x.getTableData(), []),
      getColumnData: (colKey: any) => callCoreOr(core, (x) => x.getColumnData(colKey), []),
      getPending: () => callCoreOr(core, (x) => x.getPending(), new Map()),
      getPendingRowIds: () => callCoreOr(core, (x) => x.getPendingRowIds(), []),
      hasPendingChanges: () => callCoreOr(core, (x) => x.hasPendingChanges(), false),
      getPendingCellCount: () => callCoreOr(core, (x) => x.getPendingCellCount(), 0),
      getRowIndex: (rowId: string) => callCoreOr(core, (x) => x.getRowIndex(rowId), -1),
      getColumnIndex: (colKey: string) => callCoreOr(core, (x) => x.getColumnIndex(colKey), -1),
      getAllRows: () => callCoreOr(core, (x) => x.getAllRows(), []),
      listRows: () => callCoreOr(core, (x) => x.listRows(), []),
      setCellValue: (row: any, colKey: any, next: any) =>
        callCore(core, (x) => x.setCellValue(row as never, colKey as never, next as never)),
      setValueToSelection: (next: any) => {
        callCore(core, (x) => x.setValueToSelection(next));
      },
      insertRow: (rowData: any, pos?: any) => callCoreOr(core, (x) => x.insertRow(rowData, pos), null),
      deleteRow: (row: any) => callCoreOr(core, (x) => x.deleteRow(row), false),
      undo: () => {
        callCore(core, (x) => x.undo());
      },
      redo: () => {
        callCore(core, (x) => x.redo());
      },
      getUndoRedoHistory: () => callCoreOr(core, (x) => x.getUndoRedoHistory(), { undo: [], redo: [] }),
      commit: (handler?: CommitHandler) =>
        handler
          ? callCorePromiseOr(core, (x) => x.commit(handler), Promise.resolve([]))
          : callCorePromiseOr(core, (x) => x.commit(), Promise.resolve([])),
      subscribeTableState: (listener: any) =>
        callCoreOr(core, (x) => x.subscribeTableState(listener), () => false),
      subscribeSelection: (listener: any) =>
        callCoreOr(core, (x) => x.subscribeSelection(listener), () => false),
      getSelectionSnapshot: () => callCoreOr(core, (x) => x.getSelectionSnapshot(), emptySelectionSnapshot),
    };

    expose(handle);

    return () =>
      h("div", {
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
