<script setup lang="ts">
import { ref } from "vue";
import { defineSchema } from "@extable/core";
import type { View, UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

interface NumbersRow {
  id: number;
  dec2: number;
  decGrouped0: number;
  sci6: number;
  intDec: number;
  intHex: number;
  intOct: number;
  intBin: number;
  uintHex: number;
  note: string;
}

const tableRef = ref<ExtableVueHandle | null>(null);

const schema = defineSchema<NumbersRow>({
  columns: [
    { key: "id", header: "#", type: "uint", readonly: true, width: 50 },
    {
      key: "dec2",
      header: "Decimal (2dp)",
      type: "number",
      format: { format: "decimal", scale: 2, thousandSeparator: true, negativeRed: true },
      width: 140,
      style: { align: "right" },
    },
    {
      key: "decGrouped0",
      header: "Decimal (grouped)",
      type: "number",
      format: { format: "decimal", scale: 0, thousandSeparator: true, negativeRed: true },
      width: 160,
      style: { align: "right" },
    },
    {
      key: "sci6",
      header: "Scientific (p=6)",
      type: "number",
      format: { format: "scientific", precision: 6, negativeRed: true },
      width: 160,
      style: { align: "right" },
    },
    {
      key: "intDec",
      header: "Int (decimal)",
      type: "int",
      format: { thousandSeparator: true },
      width: 140,
      style: { align: "right" },
    },
    {
      key: "intHex",
      header: "Int (hex)",
      type: "int",
      format: { format: "hex" },
      width: 120,
      style: { align: "right" },
    },
    {
      key: "intOct",
      header: "Int (octal)",
      type: "int",
      format: { format: "octal" },
      width: 130,
      style: { align: "right" },
    },
    {
      key: "intBin",
      header: "Int (binary)",
      type: "int",
      format: { format: "binary" },
      width: 160,
      style: { align: "right" },
    },
    {
      key: "uintHex",
      header: "UInt (hex)",
      type: "uint",
      format: { format: "hex" },
      width: 130,
      style: { align: "right" },
    },
    { key: "note", header: "Note", type: "string", width: 120 },
  ],
});

const view = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

const defaultData: NumbersRow[] = [];
for (let i = 1; i <= 40; i += 1) {
  const negative = i % 5 === 0;
  const sign = negative ? -1 : 1;
  const base = i * 123;
  const intVal = sign * (base + (i % 7));
  const sciVal = sign * (i * 12_345.678);
  const uintVal = i * 16 + (i % 16);
  defaultData.push({
    id: i,
    dec2: sign * (i * 10.25 + (i % 3) * 0.1),
    decGrouped0: sign * (i * 12345),
    sci6: sciVal,
    intDec: intVal,
    intHex: intVal,
    intOct: intVal,
    intBin: intVal,
    uintHex: uintVal,
    note: negative ? "negative" : "",
  });
}

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
    <div class="demo-note">
      <strong>Tip:</strong> Try editing numeric cells with <code>0b</code>/<code>0o</code>/<code>0x</code>
      prefixes or scientific notation like <code>1e3</code>. Full-width digits like <code>１２３</code> are
      normalized on commit.
    </div>

    <div class="demo-controls">
      <div class="edit-controls">
        <button @click="handleUndo">↶ Undo</button>
        <button @click="handleRedo">↷ Redo</button>
      </div>
    </div>

    <div class="demo-table" style="height: 420px; border: 1px solid #d0d7de; overflow: visible">
      <Extable
        ref="tableRef"
        :schema="schema"
        :defaultData="defaultData"
        :defaultView="view"
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

.edit-controls {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.demo-table {
  border-radius: 6px;
  overflow: visible;
}

.edit-controls button {
  padding: 4px 8px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.edit-controls button:hover {
  background-color: #f6f8fa;
}

.edit-controls button:active {
  background-color: #eaeef2;
}
</style>
