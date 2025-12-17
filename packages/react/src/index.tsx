import type { CSSProperties, HTMLAttributes } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ForwardedRef } from "react";
import type {
  CoreOptions,
  EditMode,
  LockMode,
  NullableDataSet,
  Schema,
  SelectionChangeReason,
  SelectionSnapshot,
  TableState,
  View,
} from "@extable/core";
import { ExtableCore } from "@extable/core";

export type ExtableHandle<T extends Record<string, unknown> = Record<string, unknown>> = {
  getCore(): ExtableCore<T> | null;
  destroy(): void;

  setData(data: NullableDataSet<T>): void;
  setView(view: View): void;
  setSchema(schema: Schema): void;

  setEditMode(mode: EditMode): void;
  setLockMode(mode: LockMode): void;
};

export type ExtableProps<T extends Record<string, unknown> = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  schema: Schema;
  defaultData: NullableDataSet<T>;
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
    () => ({
      getCore: () => coreRef.current,
      destroy: () => {
        coreRef.current?.destroy();
        coreRef.current = null;
      },

      setData: (data) => coreRef.current?.setData(data),
      setView: (view) => coreRef.current?.setView(view),
      setSchema: (nextSchema) => coreRef.current?.setSchema(nextSchema),

      setEditMode: (mode) => coreRef.current?.setEditMode(mode),
      setLockMode: (mode) => coreRef.current?.setLockMode(mode),
    }),
    [],
  );

  const className = ["extable-root", divProps.className].filter(Boolean).join(" ");
  return <div data-extable-wrapper ref={containerRef} {...divProps} className={className} />;
});

export type {
  CoreOptions,
  EditMode,
  LockMode,
  NullableDataSet,
  Schema,
  SelectionChangeReason,
  SelectionSnapshot,
  TableState,
  View,
};
