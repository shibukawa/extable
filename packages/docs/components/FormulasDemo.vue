<script setup lang="ts">
import { ref } from "vue";
import { defineSchema } from "@extable/core";
import type { View, UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

const tableRef = ref<ExtableVueHandle | null>(null);

const schema = defineSchema<InvoiceItem>({
  columns: [
    { key: "id", header: "Item ID", type: "string", readonly: true, width: 100 },
    { key: "description", header: "Description", type: "string", width: 180 },
    {
      key: "quantity",
      header: "Qty",
      type: "number",
      number: { precision: 6, scale: 0 },
      width: 80,
      style: { align: "center" },
    },
    {
      key: "unitPrice",
      header: "Unit Price ($)",
      type: "number",
      number: { precision: 8, scale: 2 },
      width: 130,
      style: { align: "right" },
    },
    {
      key: "discountPercent",
      header: "Discount (%)",
      type: "number",
      number: { precision: 5, scale: 1 },
      width: 120,
      style: { align: "center" },
    },
    {
      key: "total",
      header: "Total ($)",
      type: "number",
      number: { precision: 10, scale: 2 },
      readonly: true,
      formula: (row) => row.quantity * row.unitPrice * (1 - row.discountPercent / 100),
      width: 130,
      style: { align: "right", backgroundColor: "#f0fdf4" },
    },
  ],
});

const view = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

function generateInvoiceData(): InvoiceItem[] {
  const descriptions = [
    "Cloud Storage (100GB/month)",
    "Support License (Per User)",
    "Database Backup Service",
    "Security Audit",
    "Custom Integration",
    "Performance Monitoring",
    "Training Session (2 hours)",
    "API License",
  ];
  const rows: InvoiceItem[] = [];

  for (let i = 1; i <= 20; i++) {
    const description = descriptions[i % descriptions.length];
    const quantity = Math.floor(Math.random() * 50) + 1;
    const unitPrice = Math.round((Math.random() * 500 + 10) * 100) / 100;
    const discountPercent = Math.random() > 0.7 ? Math.round(Math.random() * 20 * 10) / 10 : 0;

    rows.push({
      id: `ITEM-${String(i).padStart(4, "0")}`,
      description,
      quantity,
      unitPrice,
      discountPercent,
      total: 0, // Will be calculated by formula
    });
  }
  return rows;
}

const defaultData = generateInvoiceData();
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
</script>

<template>
  <div class="demo-container">
    <div class="demo-note">
      <strong>Formula Support:</strong> The "Total", "Tax", and "Final Amount" columns use formulas to automatically
      calculate values based on editable columns. Edit quantity or unit price to see calculations update instantly.
    </div>

    <div class="formula-legend">
      <div class="formula-item">
        <span class="formula-label">Total</span>
        <span class="formula-expr">= quantity × unitPrice × (1 - discount%)</span>
      </div>
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

.search-panel {
  display: flex;
  gap: 4px;
}

.edit-controls {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.formula-legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.formula-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background-color: #f6f8fa;
  border-radius: 4px;
  border-left: 3px solid #0969da;
  font-size: 12px;
}

.formula-label {
  font-weight: 600;
  color: #24292f;
}

.formula-expr {
  color: #57606a;
  font-family: monospace;
  font-size: 11px;
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

button:hover {
  background-color: #f6f8fa;
}

button:active {
  background-color: #eaeef2;
}
</style>
