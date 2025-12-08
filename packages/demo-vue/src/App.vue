<template>
  <main>
    <h1>Extable Demo (Vue)</h1>
    <section class="controls">
      <div>
        <h2>Render Mode</h2>
        <label>
          <input v-model="mode" name="mode" type="radio" value="html" />
          HTML
        </label>
        <label>
          <input v-model="mode" name="mode" type="radio" value="canvas" />
          Canvas
        </label>
      </div>
      <div>
        <h2>User Mode</h2>
        <label>
          <input v-model="userMode" name="user-mode" type="radio" value="single" />
          Single
        </label>
        <label>
          <input v-model="userMode" name="user-mode" type="radio" value="multi" />
          Multi
        </label>
      </div>
    </section>
    <section>
      <h2>Wrapper Mount</h2>
      <Extable :config="config" :options="options" />
    </section>
    <section>
      <h2>State Preview</h2>
      <pre>{{ statePreview }}</pre>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Extable, type CoreOptions, type TableConfig } from '@extable/vue';

type Mode = 'html' | 'canvas';
type UserMode = 'single' | 'multi';

const mode = ref<Mode>('html');
const userMode = ref<UserMode>('single');

const options = computed<CoreOptions>(() => ({
  renderMode: mode.value,
  editMode: userMode.value === 'single' ? 'direct' : 'commit',
  lockMode: 'none'
}));
const config = ref<TableConfig>({ data: { rows: [] }, schema: { columns: [] }, view: {} });

const statePreview = computed(() => JSON.stringify({ mode: mode.value, userMode: userMode.value }, null, 2));
</script>
