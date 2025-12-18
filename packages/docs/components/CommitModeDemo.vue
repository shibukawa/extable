<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import type { CoreOptions, UserInfo, RowStateSnapshot } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import { generateEmployeeWithStatusData, commitEmployeeSchema, defaultEmployeeView, type DemoEmployee } from "./demoDataGenerators";
import "@extable/core/style.css";

const tableRef = ref<ExtableVueHandle<Record<string, unknown>, DemoEmployee> | null>(null);
const commitLog = ref<string>("");
const canCommit = ref<boolean>(false);

function generateCommitModeData(): DemoEmployee[] {
  const data = generateEmployeeWithStatusData(30);
  // Add salary field for this demo
  return data.map((emp, i) => ({
    ...emp,
    salary: 60000 + i * 2000,
  }));
}

const defaultData = generateCommitModeData();
const user: UserInfo = { id: "demo-user", name: "Demo User" };

const options = computed<CoreOptions>(() => ({
  renderMode: "auto",
  editMode: "commit",
  user,
}));

let unsubscribe: (() => void) | null = null;

onMounted(() => {
  const table = tableRef.value;
  if (table) {
    unsubscribe = table.subscribeTableState((state) => {
      canCommit.value = state.canCommit;
    });
  }
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

function handleSearch() {
  tableRef.value?.toggleSearchPanel("find");
}

async function handleCommit() {
  const table = tableRef.value;
  if (!table) return;

  try {
    const snapshots: RowStateSnapshot<Record<string, unknown>, DemoEmployee>[] = await table.commit();

    // Add to log
    const timestamp = new Date().toLocaleTimeString();
    let logEntry = `[${timestamp}] Committed ${snapshots.length} row(s):\n`;

    snapshots.forEach((snap, index) => {
      logEntry += `  Row ${index + 1}: ${JSON.stringify(snap.data)}\n`;
    });

    commitLog.value = logEntry + (commitLog.value ? "\n" + commitLog.value : "");
  } catch (error) {
    const timestamp = new Date().toLocaleTimeString();
    commitLog.value = `[${timestamp}] Commit failed: ${error}\n` + commitLog.value;
  }
}

function handleUndo() {
  tableRef.value?.undo();
}

function handleRedo() {
  tableRef.value?.redo();
}
</script>

<template>
  <div class="demo-container">
    <div class="demo-note">
      <strong>Commit Mode:</strong> Changes are staged but not saved immediately. Use the buttons below to
      commit or undo changes. This allows batch editing before saving to the server.
    </div>

    <div class="demo-controls">
      <div class="search-panel">
        <button @click="handleSearch">🔍 Search</button>
      </div>
      <div class="edit-controls">
        <button @click="handleUndo">↶ Undo</button>
        <button @click="handleRedo">↷ Redo</button>
        <button @click="handleCommit" :disabled="!canCommit">✓ Commit</button>
      </div>
    </div>

    <div class="demo-table" style="height: 400px; border: 1px solid #d0d7de; overflow: visible">
      <Extable
        ref="tableRef"
        :schema="commitEmployeeSchema"
        :defaultData="defaultData"
        :defaultView="defaultEmployeeView"
        :options="options"
        style="height: 100%; width: 100%"
      />
    </div>

    <div class="demo-log-section">
      <label for="commit-log">Commit Log:</label>
      <textarea
        id="commit-log"
        :value="commitLog"
        readonly
        class="commit-log"
        placeholder="Edit rows and click Commit to see changes logged here..."
      />
    </div>

    <div class="demo-footer">
      <small>Edit multiple cells and use the Commit button to submit all changes at once. Changes are logged below.</small>
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
  background-color: #ddf4ff;
  border: 1px solid #79c0ff;
  border-radius: 4px;
  color: #0a3622;
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

.demo-log-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.demo-log-section label {
  font-weight: 600;
  font-size: 13px;
  color: #24292f;
}

.commit-log {
  width: 100%;
  height: 200px;
  padding: 12px;
  font-family: "Menlo", "Monaco", "Courier New", monospace;
  font-size: 12px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background-color: #f6f8fa;
  color: #24292f;
  resize: vertical;
  line-height: 1.5;
}

.demo-footer {
  font-size: 12px;
  color: #57606a;
  padding: 8px;
  background-color: #f6f8fa;
  border-radius: 4px;
  text-align: center;
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
  background-color: #f6f8fa;
  color: #8c959f;
  border-color: #d0d7de;
  cursor: not-allowed;
}
</style>
