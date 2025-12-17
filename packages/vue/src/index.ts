import type {
  CoreOptions,
  EditMode,
  LockMode,
  NullableDataSet,
  RenderMode,
  Schema,
  SelectionChangeReason,
  SelectionSnapshot,
  TableState,
  View,
} from "@extable/core";
import { ExtableCore } from "@extable/core";
import { PropType, defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from "vue";

export const Extable = defineComponent({
  name: 'Extable',
  inheritAttrs: true,
  props: {
    schema: {
      type: Object as PropType<Schema>,
      required: true,
    },
    defaultData: {
      type: Object as PropType<NullableDataSet>,
      required: true,
    },
    defaultView: {
      type: Object as PropType<View>,
      required: true,
    },
    options: {
      type: Object as PropType<CoreOptions>,
      required: false,
    }
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
      unsubSel = core.subscribeSelection((next, prev, reason) => emit("cellEvent", next, prev, reason));
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
        if (prev === null && next !== null) core.setData(next);
      },
    );

    expose({
      getCore: () => core,
      destroy: () => {
        core?.destroy();
        core = null;
      },
      setData: (data: NullableDataSet) => core?.setData(data),
      setView: (view: View) => core?.setView(view),
      setSchema: (schema: Schema) => core?.setSchema(schema),
      setRenderMode: (mode: RenderMode) => core?.setRenderMode(mode),
      setEditMode: (mode: EditMode) => core?.setEditMode(mode),
      setLockMode: (mode: LockMode) => core?.setLockMode(mode),
    });

    return () =>
      h('div', {
        ref: root,
        "data-extable-wrapper": "",
        ...attrs,
        class: ["extable-root", (attrs as any).class],
      });
  }
});

export type {
  CoreOptions,
  EditMode,
  LockMode,
  NullableDataSet,
  RenderMode,
  Schema,
  SelectionChangeReason,
  SelectionSnapshot,
  TableState,
  View,
};

export type ExtableVueHandle<T extends Record<string, unknown> = Record<string, unknown>> = {
  getCore(): ExtableCore<T> | null;
  destroy(): void;

  setData(data: NullableDataSet<T>): void;
  setView(view: View): void;
  setSchema(schema: Schema): void;

  setRenderMode(mode: RenderMode): void;
  setEditMode(mode: EditMode): void;
  setLockMode(mode: LockMode): void;
};
