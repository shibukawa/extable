<script setup lang="ts">
import { ref } from "vue";
import type { Schema, View, UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

interface Order {
  id: string;
  orderDate: string;
  customer: string;
  amount: number;
  status: "pending" | "processing" | "shipped" | "delivered";
  region: "North" | "South" | "East" | "West";
  priority: "low" | "medium" | "high";
}

const tableRef = ref<ExtableVueHandle | null>(null);
const filterInfo = ref<string>("");

const schema = {
  columns: [
    { key: "id", header: "Order ID", type: "string", readonly: true, width: 120 },
    {
      key: "orderDate",
      header: "Order Date",
      type: "date",
      readonly: true,
      width: 120,
      style: { align: "center" },
    },
    { key: "customer", header: "Customer", type: "string", width: 150 },
    {
      key: "amount",
      header: "Amount ($)",
      type: "number",
      format: { precision: 10, scale: 2 },
      width: 130,
      style: { align: "right" },
    },
    {
      key: "status",
      header: "Status",
      type: "enum",
      enum: { options: ["pending", "processing", "shipped", "delivered"] },
      width: 140,
    },
    {
      key: "region",
      header: "Region",
      type: "enum",
      enum: { options: ["North", "South", "East", "West"] },
      width: 120,
    },
    {
      key: "priority",
      header: "Priority",
      type: "enum",
      enum: { options: ["low", "medium", "high"] },
      width: 120,
    },
  ],
} satisfies Schema;

const initialView = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

function generateOrderData(): Order[] {
  const regions: Array<"North" | "South" | "East" | "West"> = ["North", "South", "East", "West"];
  const statuses: Array<"pending" | "processing" | "shipped" | "delivered"> = [
    "pending",
    "processing",
    "shipped",
    "delivered",
  ];
  const priorities: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
  const rows: Order[] = [];

  // Create a pool of customer names that will be shuffled and repeated
  const customerPool = Array.from({ length: 12 }, (_, i) => `Customer ${i + 1}`);
  const shuffledCustomers: string[] = [];

  // Shuffle and extend the pool to cover 50 rows with duplicates
  for (let i = 0; i < 50; i++) {
    shuffledCustomers.push(customerPool[Math.floor(Math.random() * customerPool.length)]);
  }

  for (let i = 1; i <= 50; i++) {
    const orderYear = 2024;
    const orderMonth = String((i % 12) + 1).padStart(2, "0");
    const orderDay = String((i % 28) + 1).padStart(2, "0");

    rows.push({
      id: `ORD-${String(i).padStart(6, "0")}`,
      orderDate: `${orderYear}-${orderMonth}-${orderDay}`,
      customer: shuffledCustomers[i - 1],
      amount: Math.round((Math.random() * 50000 + 100) * 100) / 100,
      status: statuses[i % statuses.length],
      region: regions[i % regions.length],
      priority: priorities[i % priorities.length],
    });
  }
  return rows;
}

function updateFilterInfo(view: View) {
  if (view.filters && view.filters.length > 0) {
    const filterTexts = view.filters.map((f) => {
      if (f.kind === "values") {
        return `${f.key}: ${(f.values || []).join(", ")}`;
      }
      return `${f.key}`;
    });
    filterInfo.value = `Active filters: ${filterTexts.join("; ")}`;
  } else {
    filterInfo.value = "No filters applied (click filter icon in table header to add)";
  }
}

const defaultData = generateOrderData();
const user: UserInfo = { id: "demo-user", name: "Demo User" };

function handleUndo() {
  tableRef.value?.undo();
}

function handleRedo() {
  tableRef.value?.redo();
}

updateFilterInfo(initialView);
</script>

<template>
  <div class="demo-container">
    <div class="demo-note">
      <strong>Filter Support:</strong> Click the filter icon (🔻) in any column header to filter and sort data like Excel. Try filtering by Customer, Status, Region, or Priority, or sort by Amount or Order Date!
    </div>

    <div class="filter-status">
      <span>{{ filterInfo }}</span>
    </div>

    <div class="demo-controls">
      <div class="edit-controls">
        <button @click="handleUndo">↶ Undo</button>
        <button @click="handleRedo">↷ Redo</button>
      </div>
    </div>

    <div class="demo-table" style="height: 560px; border: 1px solid #d0d7de; overflow: visible">
      <Extable
        ref="tableRef"
        :schema="schema"
        :defaultData="defaultData"
        :defaultView="initialView"
        :options="{ user }"
        style="height: 100%; width: 100%"
      />
    </div>

    <div class="filter-tip">
      <small><strong>Tip:</strong> Click the filter icon in column headers to open the filter panel.</small>
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

.filter-status {
  font-size: 12px;
  padding: 8px 12px;
  background-color: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 4px;
  color: #166534;
}

.demo-table {
  border-radius: 6px;
  overflow: hidden;
}

.filter-tip {
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

button:hover {
  background-color: #f6f8fa;
}

button:active {
  background-color: #eaeef2;
}
</style>
