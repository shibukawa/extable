<script setup lang="ts">
import { computed, ref } from "vue";
import type { CoreOptions, UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import { generateEmployeeData, readonlyEmployeeSchema, defaultEmployeeView, type DemoEmployee } from "./demoDataGenerators";
import "@extable/core/style.css";

const tableRef = ref<ExtableVueHandle | null>(null);

function generateReadonlyEmployeeData(): DemoEmployee[] {
  const data = generateEmployeeData(50);
  // Add salary field for this demo
  return data.map((emp, i) => ({
    ...emp,
    salary: 50000 + i * 1000 + Math.floor(Math.random() * 50000),
  }));
}

const defaultData = generateReadonlyEmployeeData();

const options = computed<CoreOptions>(() => ({
  editMode: "readonly",
  user: { id: "demo-user", name: "Demo User" },
}));

function handleSearch() {
  tableRef.value?.toggleSearchPanel("find");
}
</script>

<template>
  <div class="demo-container">
    <div class="demo-note">
      <strong>Read-only Mode:</strong> All cells are locked. Users can select and copy data, but cannot edit any
      values. This is useful for viewing sensitive data or reference tables.
    </div>

    <div class="demo-controls">
      <div class="search-panel">
        <button @click="handleSearch">🔍 Search</button>
      </div>
      <div class="edit-controls">
        <button disabled>↶ Undo</button>
        <button disabled>↷ Redo</button>
      </div>
    </div>

    <div class="demo-table" style="height: 400px; border: 1px solid #d0d7de; overflow: visible">
      <Extable
        ref="tableRef"
        :schema="readonlyEmployeeSchema"
        :defaultData="defaultData"
        :defaultView="defaultEmployeeView"
        :options="options"
        style="height: 100%; width: 100%"
      />
    </div>
  </div>
</template>

<style scoped>
.demo-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 20px 0;
}

.demo-note {
  font-size: 13px;
  padding: 12px;
  background-color: #fff8c5;
  border: 1px solid #d4a574;
  border-radius: 4px;
  color: #54524e;
}

.demo-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-panel {
  display: flex;
  gap: 4px;
  align-items: center;
}

.edit-controls {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.demo-table {
  border-radius: 6px;
  overflow: hidden;
}

button {
  padding: 4px 8px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #f6f8fa;
}

button:active:not(:disabled) {
  background-color: #eaeef2;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
