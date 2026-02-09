import type { CSSProperties, HTMLAttributes } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ForwardedRef } from "react";
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

type CoreApi<T extends object, R extends object = T> = Pick<
  ExtableCore<T, R>,
  | "setData"
  | "setView"
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

export type ExtableHandle<T extends object = Record<string, unknown>, R extends object = T> =
  CoreApi<T, R> & {
    destroy(): void;
  };

export type ExtableProps<T extends Record<string, unknown> = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  schema: Schema<any>;
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
  const initialSchemaRef = useRef(schema);
  const initialViewRef = useRef(defaultView);

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
      const getCore = () => coreRef.current;
      const proxy: ExtableHandle<T> = {
        destroy: () => {
          coreRef.current?.destroy();
          coreRef.current = null;
        },
        setData: (data) => {
          callCore(getCore(), (core) => core.setData(data));
        },
        setView: (view) => {
          callCore(getCore(), (core) => core.setView(view));
        },
        getData: () => callCoreOr(getCore(), (core) => core.getData(), []),
        getRawData: () => callCoreOr(getCore(), (core) => core.getRawData(), []),
        getSchema: () => callCoreOr(getCore(), (core) => core.getSchema(), initialSchemaRef.current),
        getView: () => callCoreOr(getCore(), (core) => core.getView(), initialViewRef.current),
        getCell: (rowId: string, colKey: any) => callCore(getCore(), (core) => core.getCell(rowId, colKey)),
        getDisplayValue: (row: any, colKey: any) =>
          callCoreOr(getCore(), (core) => core.getDisplayValue(row, colKey), ""),
        getCellPending: (row: any, colKey: any) =>
          callCoreOr(getCore(), (core) => core.getCellPending(row, colKey), false),
        getRow: (row: any) => callCoreOr(getCore(), (core) => core.getRow(row), null),
        getTableData: () => callCoreOr(getCore(), (core) => core.getTableData(), []),
        getColumnData: (colKey: any) => callCoreOr(getCore(), (core) => core.getColumnData(colKey), []),
        getPending: () => callCoreOr(getCore(), (core) => core.getPending(), new Map()),
        getPendingRowIds: () => callCoreOr(getCore(), (core) => core.getPendingRowIds(), []),
        hasPendingChanges: () => callCoreOr(getCore(), (core) => core.hasPendingChanges(), false),
        getPendingCellCount: () => callCoreOr(getCore(), (core) => core.getPendingCellCount(), 0),
        getRowIndex: (rowId: string) => callCoreOr(getCore(), (core) => core.getRowIndex(rowId), -1),
        getColumnIndex: (colKey: string) =>
          callCoreOr(getCore(), (core) => core.getColumnIndex(colKey), -1),
        getAllRows: () => callCoreOr(getCore(), (core) => core.getAllRows(), []),
        listRows: () => callCoreOr(getCore(), (core) => core.listRows(), []),
        setCellValue: (row: any, colKey: any, next: any) =>
          callCore(getCore(), (core) => core.setCellValue(row as never, colKey as never, next as never)),
        setValueToSelection: (next: any) => {
          callCore(getCore(), (core) => core.setValueToSelection(next));
        },
        insertRow: (rowData: any, pos?: any) =>
          callCoreOr(getCore(), (core) => core.insertRow(rowData, pos), null),
        deleteRow: (row: any) => callCoreOr(getCore(), (core) => core.deleteRow(row), false),
        undo: () => {
          callCore(getCore(), (core) => core.undo());
        },
        redo: () => {
          callCore(getCore(), (core) => core.redo());
        },
        getUndoRedoHistory: () =>
          callCoreOr(getCore(), (core) => core.getUndoRedoHistory(), { undo: [], redo: [] }),
        commit: (handler?: CommitHandler) =>
          handler
            ? callCorePromiseOr(getCore(), (core) => core.commit(handler), Promise.resolve([]))
            : callCorePromiseOr(getCore(), (core) => core.commit(), Promise.resolve([])),
        subscribeTableState: (listener: any) =>
          callCoreOr(getCore(), (core) => core.subscribeTableState(listener), () => false),
        subscribeSelection: (listener: any) =>
          callCoreOr(getCore(), (core) => core.subscribeSelection(listener), () => false),
        getSelectionSnapshot: () =>
          callCoreOr(getCore(), (core) => core.getSelectionSnapshot(), emptySelectionSnapshot),
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
