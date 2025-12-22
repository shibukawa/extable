<script setup lang="ts">
import { ref } from "vue";
import { defineSchema } from "@extable/core";
import type { View, UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: "available" | "discontinued" | "low-stock";
  revenue: number;
}

const tableRef = ref<ExtableVueHandle | null>(null);

const schema = defineSchema<Product>({
  columns: [
    { key: "id", header: "Product ID", type: "string", readonly: true, width: 110 },
    {
      key: "name",
      header: "Product Name",
      type: "string",
      width: 150,
      style: {
        textColor: "#24292f",
        backgroundColor: "#f6f8fa",
        decorations: {
          bold: true,
        },
      },
    },
    {
      key: "category",
      header: "Category",
      type: "string",
      width: 120,
    },
    {
      key: "price",
      header: "Price ($)",
      type: "number",
      format: { precision: 8, scale: 2 },
      width: 120,
      style: {
        align: "right",
        textColor: "#0969da",
      },
    },
    {
      key: "stock",
      header: "Stock",
      type: "number",
      format: { precision: 6, scale: 0 },
      width: 100,
      style: {
        align: "center",
      },
    },
    {
      key: "status",
      header: "Status",
      type: "enum",
      enum: { options: ["available", "discontinued", "low-stock"] },
      width: 130,
      style: {
        backgroundColor: "#fffbcc",
        textColor: "#7f4e00",
      },
    },
    {
      key: "revenue",
      header: "Revenue ($)",
      type: "number",
      format: { precision: 12, scale: 2 },
      width: 140,
      style: {
        align: "right",
        textColor: "#28a745",
        backgroundColor: "#f0fdf4",
      },
    },
  ],
});

const view = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

function generateProductData(): Product[] {
  const categories = ["Electronics", "Software", "Services", "Hardware"];
  const statuses: Array<"available" | "discontinued" | "low-stock"> = [
    "available",
    "discontinued",
    "low-stock",
  ];
  const rows: Product[] = [];

  for (let i = 1; i <= 40; i++) {
    const price = Math.round((Math.random() * 10000 + 100) * 100) / 100;
    const stock = Math.floor(Math.random() * 500);
    rows.push({
      id: `PROD-${String(i).padStart(5, "0")}`,
      name: `Product ${i}`,
      category: categories[i % categories.length],
      price,
      stock,
      status: statuses[i % statuses.length],
      revenue: Math.round(price * stock * (Math.random() * 0.8 + 0.5) * 100) / 100,
    });
  }
  return rows;
}

const defaultData = generateProductData();
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
      <strong>Column Formatting:</strong> Cells are formatted with custom background colors, text colors, and
      alignment. Price and Revenue columns are right-aligned and color-coded to highlight financial data.
    </div>

    <div class="formatting-legend">
      <div class="legend-item">
        <span class="legend-color" style="background-color: #f0fdf4; color: #28a745">Revenue ($)</span>
        <span>Green background for revenue metrics</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background-color: #fffbcc; color: #7f4e00">Status</span>
        <span>Yellow background for status indicators</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background-color: #f6f8fa">Product Name</span>
        <span>Light gray background for key identifiers</span>
      </div>
    </div>

    <div class="demo-controls">
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

.edit-controls {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.formatting-legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.legend-color {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 3px;
  font-weight: 500;
  min-width: 100px;
  text-align: center;
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
