<script setup lang="ts">
import { ref } from "vue";
import { defineSchema } from "@extable/core"
import type { View, UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

interface DemoRow {
  id: string;
  name: string;
  active: boolean;
  score: number;
  role: "viewer" | "editor" | "owner";
  tags: string[];
  notes: string;
}

const tableRef = ref<ExtableVueHandle<DemoRow> | null>(null);
const stats = ref<{ renderTime: number; rowCount: number }>({ renderTime: 0, rowCount: 0 });

const schema = defineSchema<DemoRow>({
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "active", header: "Active", type: "boolean", format: "checkbox", width: 100 },
    {
      key: "score",
      header: "Score",
      type: "number",
      format: { precision: 6, scale: 2 },
      style: { align: "right" },
      width: 120,
    },
    {
      key: "role",
      header: "Role",
      type: "enum",
      enum: ["viewer", "editor", "owner"],
      width: 130,
    },
    {
      key: "tags",
      header: "Tags",
      type: "tags",
      tags: ["alpha", "beta", "priority"],
      width: 140,
    },
    {
      key: "notes",
      header: "Notes",
      type: "string",
      wrapText: true,
      width: 260,
    },
  ],
});

const view = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

function generateData(count: number): DemoRow[] {
  const rows: DemoRow[] = [];
  const noteSamples = [
    "This row backs a customer-facing report and should stay read-only until reviewed.",
    "Contains sensitive metrics; only trusted editors may adjust values for this team.",
    "Early-stage feature tracking; any changes should be noted in the change log.",
    "Used for demoing wrap-text behavior with longer descriptions that span multiple lines.",
  ];

  for (let i = 1; i <= count; i++) {
    const note = noteSamples[i % noteSamples.length];
    rows.push({
      id: `row-${i}`,
      name: `User ${i}`,
      active: i % 2 === 0,
      score: Math.round((50 + (i % 50)) * 100) / 100,
      role: i % 3 === 0 ? "owner" : i % 3 === 1 ? "editor" : "viewer",
      tags: i % 4 === 0 ? ["priority"] : i % 3 === 0 ? ["alpha"] : ["beta"],
      notes: `${note} (Row ${i} uses ID row-${i}.)`,
    });
  }
  return rows;
}

const ROW_COUNT = 10_000;
const startTime = performance.now();
const defaultData: DemoRow[] = generateData(ROW_COUNT);
const endTime = performance.now();

stats.value = {
  renderTime: Math.round((endTime - startTime) * 10) / 10,
  rowCount: ROW_COUNT,
};

const user: UserInfo = { id: "demo-user", name: "Demo User" };

function handleUndo() {
  tableRef.value?.undo();
}

function handleRedo() {
  tableRef.value?.redo();
}
</script>

<template>
  <div class="demo-container">
    <div class="demo-stats">
      <span>{{ stats.rowCount }} rows loaded in {{ stats.renderTime }}ms</span>
    </div>

    <div class="demo-controls">
      <div class="edit-controls">
        <button @click="handleUndo">↶ Undo</button>
        <button @click="handleRedo">↷ Redo</button>
      </div>
    </div>

    <div class="demo-table" style="height: 600px; border: 1px solid #d0d7de; overflow: visible">
      <Extable
        ref="tableRef"
        :schema="schema"
        :defaultData="defaultData"
        :defaultView="view"
        :options="{user}"
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
  color: #57606a;
  padding: 8px 12px;
  background-color: #f6f8fa;
  border-radius: 4px;
}

.demo-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.edit-controls {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.demo-table {
  border-radius: 6px;
  overflow: visible;
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

button:hover {
  background-color: #f6f8fa;
}

button:active {
  background-color: #eaeef2;
}

input {
  padding: 4px 8px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  font-size: 13px;
}
</style>
