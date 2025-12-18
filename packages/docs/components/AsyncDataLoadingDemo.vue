<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import { generateEmployeeData, employeeSchema, defaultEmployeeView, type DemoEmployee } from "./demoDataGenerators";
import "@extable/core/style.css";

const tableRef = ref<ExtableVueHandle | null>(null);
const defaultData = ref<DemoEmployee[] | null>(null);
const stats = ref<{ loadTime: number; rowCount: number }>({ loadTime: 0, rowCount: 0 });

async function loadDataAsync(count: number): Promise<DemoEmployee[]> {
  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(generateEmployeeData(count));
    }, 1500);
  });
}

async function loadData() {
  const startTime = performance.now();
  const data = await loadDataAsync(100);
  const endTime = performance.now();

  defaultData.value = data;
  stats.value = {
    loadTime: Math.round((endTime - startTime) * 10) / 10,
    rowCount: data.length,
  };
}

const user: UserInfo = { id: "demo-user", name: "Demo User" };

function handleSearch() {
  tableRef.value?.toggleSearchPanel("find");
}

function handleUndo() {
  tableRef.value?.undo();
}

function handleRedo() {
  tableRef.value?.redo();
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="demo-container">
    <div class="demo-stats">
      <span v-if="!defaultData" class="loading-text">Loading 100 employees...</span>
      <span v-else class="loaded-text">{{ stats.rowCount }} employees loaded in {{ stats.loadTime }}ms</span>
    </div>

    <div class="demo-controls">
      <div class="search-panel">
        <button @click="handleSearch">🔍 Search</button>
      </div>
      <div class="edit-controls">
        <button @click="handleUndo">↶ Undo</button>
        <button @click="handleRedo">↷ Redo</button>
      </div>
    </div>

    <div class="demo-table" style="height: 400px; border: 1px solid #d0d7de; overflow: visible">
      <Extable
        ref="tableRef"
        :schema="employeeSchema"
        :defaultData="defaultData"
        :defaultView="defaultEmployeeView"
        :options="{ user }"
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

.demo-stats {
  font-size: 13px;
  padding: 8px 12px;
  background: #f6f8fa;
  border-radius: 4px;
}

.demo-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-panel {
  display: flex;
  gap: 4px;
}

.edit-controls {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.loading-text {
  color: #0969da;
}

.loaded-text {
  color: #57606a;
}

.demo-table {
  border-radius: 6px;
  overflow: hidden;
}

p {
  margin: 0;
  font-size: 13px;
}

button {
  padding: 4px 8px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #f6f8fa;
}

button:active {
  background-color: #eaeef2;
}
</style>
