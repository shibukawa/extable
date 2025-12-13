import { CoreOptions, TableConfig, createTablePlaceholder, mountTable } from '@extable/core';
import { PropType, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';

export const Extable = defineComponent({
  name: 'Extable',
  props: {
    config: {
      type: Object as PropType<TableConfig>,
      required: true
    },
    options: {
      type: Object as PropType<CoreOptions>,
      required: true
    }
  },
  setup(props) {
    const root = ref<HTMLElement | null>(null);
    let core: ReturnType<typeof createTablePlaceholder> | null = null;

    onMounted(() => {
      if (!root.value) return;
      core = createTablePlaceholder(props.config, props.options);
      mountTable(root.value, core);
    });

    onBeforeUnmount(() => {
      core?.destroy();
      core = null;
    });

    return () =>
      h('div', {
        ref: root,
        'data-extable-wrapper': ''
      });
  }
});

export type { TableConfig, CoreOptions };
