import type { CSSProperties, HTMLAttributes } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ForwardedRef } from "react";
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

export type ExtableHandle<T extends Record<string, unknown> = Record<string, unknown>, R extends object = T> =
  CoreApi<T, R> & {
    destroy(): void;
  };

export type ExtableProps<T extends Record<string, unknown> = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  schema: Schema;
  defaultData: NullableData<T>;
  defaultView: View;
  options?: CoreOptions;

  onTableState?: (next: TableState, prev: TableState | null) => void;
  onCellEvent?: (
    next: SelectionSnapshot,
    prev: SelectionSnapshot | null,
    reason: SelectionChangeReason,
  ) => void;

  className?: string;
  style?: CSSProperties;
};

/**
 * Uncontrolled-only wrapper.
 * - `schema/defaultData/defaultView/options` are initial values.
 * - For updates after mount, use imperative methods via ref.
 * - `defaultData` supports `null -> data` transition for loading flows.
 */
export const Extable = forwardRef(function ExtableInner<
  T extends Record<string, unknown> = Record<string, unknown>,
>(props: ExtableProps<T>, ref: ForwardedRef<ExtableHandle<T>>) {
  const { schema, defaultData, defaultView, options, onTableState, onCellEvent, ...divProps } =
    props;

  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<ExtableCore<T> | null>(null);
  const initialDefaultDataWasNullRef = useRef(defaultData === null);
  const consumedDefaultDataLoadRef = useRef(false);
  const onTableStateRef = useRef<typeof onTableState>(onTableState);
  const onCellEventRef = useRef<typeof onCellEvent>(onCellEvent);

  useEffect(() => {
    onTableStateRef.current = onTableState;
  }, [onTableState]);
  useEffect(() => {
    onCellEventRef.current = onCellEvent;
  }, [onCellEvent]);

  useEffect(() => {
    if (!containerRef.current) return;
    const core = new ExtableCore<T>({
      root: containerRef.current,
      schema,
      defaultData,
      defaultView,
      options,
    });
    coreRef.current = core;
    const unsubTable = core.subscribeTableState((next, prev) =>
      onTableStateRef.current?.(next, prev),
    );
    const unsubSel = core.subscribeSelection((next, prev, reason) =>
      onCellEventRef.current?.(next, prev, reason),
    );
    return () => {
      unsubSel();
      unsubTable();
      core.destroy();
      coreRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const core = coreRef.current;
    if (!core) return;
    if (!initialDefaultDataWasNullRef.current) return;
    if (consumedDefaultDataLoadRef.current) return;
    if (defaultData !== null) {
      core.setData(defaultData);
      consumedDefaultDataLoadRef.current = true;
    }
  }, [defaultData]);

  useImperativeHandle(
    ref,
    () => {
      const proxy: ExtableHandle<T> = {
        destroy: () => {
          coreRef.current?.destroy();
          coreRef.current = null;
        },
        setData: (data) => coreRef.current?.setData(data),
        setView: (view) => coreRef.current?.setView(view),
        showSearchPanel: (mode?: FindReplaceMode) => coreRef.current?.showSearchPanel(mode),
        hideSearchPanel: () => coreRef.current?.hideSearchPanel(),
        toggleSearchPanel: (mode?: FindReplaceMode) => coreRef.current?.toggleSearchPanel(mode),
        openFindReplaceDialog: (mode?: FindReplaceMode) =>
          coreRef.current?.openFindReplaceDialog(mode),
        closeFindReplaceDialog: () => coreRef.current?.closeFindReplaceDialog(),
        getData: () => coreRef.current?.getData() ?? [],
        getRawData: () => coreRef.current?.getRawData() ?? [],
        getSchema: () => coreRef.current?.getSchema(),
        getView: () => coreRef.current?.getView(),
        getCell: (rowId: string, colKey: any) => coreRef.current?.getCell(rowId, colKey),
        getDisplayValue: (row: any, colKey: any) =>
          coreRef.current?.getDisplayValue(row, colKey) ?? "",
        getCellPending: (row: any, colKey: any) => coreRef.current?.getCellPending(row, colKey) ?? false,
        getRow: (row: any) => coreRef.current?.getRow(row),
        getRowData: (row: any) => coreRef.current?.getRowData(row),
        getTableData: () => coreRef.current?.getTableData() ?? [],
        getColumnData: (colKey: any) => coreRef.current?.getColumnData(colKey) ?? [],
        getPending: () => coreRef.current?.getPending() ?? new Map(),
        getPendingRowIds: () => coreRef.current?.getPendingRowIds() ?? [],
        hasPendingChanges: () => coreRef.current?.hasPendingChanges() ?? false,
        getPendingCellCount: () => coreRef.current?.getPendingCellCount() ?? 0,
        getRowIndex: (rowId: string) => coreRef.current?.getRowIndex(rowId) ?? -1,
        getColumnIndex: (colKey: string) => coreRef.current?.getColumnIndex(colKey) ?? -1,
        getAllRows: () => coreRef.current?.getAllRows() ?? [],
        listRows: () => coreRef.current?.listRows() ?? [],
        setCellValue: (row: any, colKey: any, next: any) =>
          coreRef.current?.setCellValue(row as never, colKey as never, next as never),
        setValueToSelection: (next: any) => coreRef.current?.setValueToSelection(next),
        insertRow: (rowData: any, pos?: any) => coreRef.current?.insertRow(rowData, pos) ?? null,
        deleteRow: (row: any) => coreRef.current?.deleteRow(row) ?? false,
        undo: () => coreRef.current?.undo(),
        redo: () => coreRef.current?.redo(),
        getUndoRedoHistory: () => coreRef.current?.getUndoRedoHistory(),
        commit: () => coreRef.current?.commit(),
        subscribeTableState: (listener: any) => coreRef.current?.subscribeTableState(listener),
        subscribeSelection: (listener: any) => coreRef.current?.subscribeSelection(listener),
        getSelectionSnapshot: () => coreRef.current?.getSelectionSnapshot(),
      };
      return proxy;
    },
    [],
  );

  const className = ["extable-root", divProps.className].filter(Boolean).join(" ");
  return <div data-extable-wrapper ref={containerRef} {...divProps} className={className} />;
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
