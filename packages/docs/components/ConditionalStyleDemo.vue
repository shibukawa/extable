<script setup lang="ts">
import { ref } from "vue";
import { defineSchema } from "@extable/core";
import type { View, UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

interface Performance {
  id: string;
  employee: string;
  department: string;
  score: number;
  attendance: number;
  projects: number;
  status: string;
}

const tableRef = ref<ExtableVueHandle | null>(null);

const schema = defineSchema<Performance>({
  columns: [
    { key: "id", header: "Employee ID", type: "string", readonly: true, width: 120 },
    { key: "employee", header: "Employee Name", type: "string", width: 150 },
    { key: "department", header: "Department", type: "string", width: 140 },
    {
      key: "score",
      header: "Performance Score",
      type: "number",
      number: { precision: 5, scale: 1 },
      width: 160,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.score >= 90) return { backgroundColor: "#d1fae5", textColor: "#065f46" };
        if (row.score >= 70) return { backgroundColor: "#fef3c7", textColor: "#78350f" };
        return { backgroundColor: "#fee2e2", textColor: "#7f1d1d" };
      },
    },
    {
      key: "attendance",
      header: "Attendance (%)",
      type: "number",
      number: { precision: 5, scale: 1 },
      width: 140,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.attendance >= 95) return { backgroundColor: "#dcfce7", textColor: "#166534" };
        if (row.attendance >= 85) return { backgroundColor: "#fef08a", textColor: "#713f12" };
        return { backgroundColor: "#fecaca", textColor: "#991b1b" };
      },
    },
    {
      key: "projects",
      header: "Projects Completed",
      type: "number",
      number: { precision: 3, scale: 0 },
      width: 160,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.projects >= 15) return { backgroundColor: "#bfdbfe", textColor: "#1e40af" };
        if (row.projects >= 8) return { backgroundColor: "#e0e7ff", textColor: "#3730a3" };
        return null;
      },
    },
    {
      key: "status",
      header: "Status",
      type: "string",
      readonly: true,
      width: 130,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.status === "Active") return { backgroundColor: "#ccfbf1", textColor: "#134e4a" };
        if (row.status === "On Leave") return { backgroundColor: "#fed7aa", textColor: "#92400e" };
        if (row.status === "Inactive") return { backgroundColor: "#f3f4f6", textColor: "#374151" };
        return null;
      },
    },
  ],
});

const view = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

function generatePerformanceData(): Performance[] {
  const departments = ["Engineering", "Sales", "Marketing", "HR", "Finance"];
  const statuses = ["Active", "On Leave", "Inactive"];
  const rows: Performance[] = [];

  for (let i = 1; i <= 40; i++) {
    const score = Math.round((Math.random() * 40 + 60) * 10) / 10;
    const attendance = Math.round((Math.random() * 30 + 70) * 10) / 10;
    const projects = Math.floor(Math.random() * 20);

    rows.push({
      id: `EMP-${String(i).padStart(5, "0")}`,
      employee: `Employee ${i}`,
      department: departments[i % departments.length],
      score,
      attendance,
      projects,
      status: statuses[i % statuses.length],
    });
  }
  return rows;
}

const defaultData = generatePerformanceData();
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
      <strong>Conditional Formatting:</strong> Cell colors change dynamically based on values using CEL expressions.
      Performance scores and attendance rates are color-coded to quickly identify high performers and issues.
    </div>

    <div class="conditional-legend">
      <div class="legend-section">
        <h4>Performance Score</h4>
        <div class="legend-items">
          <div class="legend-row">
            <span class="legend-swatch" style="background-color: #d1fae5; color: #065f46">≥ 90</span>
            <span>Excellent</span>
          </div>
          <div class="legend-row">
            <span class="legend-swatch" style="background-color: #fef3c7; color: #78350f">70-89</span>
            <span>Good</span>
          </div>
          <div class="legend-row">
            <span class="legend-swatch" style="background-color: #fee2e2; color: #7f1d1d">&lt; 70</span>
            <span>Needs Improvement</span>
          </div>
        </div>
      </div>

      <div class="legend-section">
        <h4>Attendance</h4>
        <div class="legend-items">
          <div class="legend-row">
            <span class="legend-swatch" style="background-color: #dcfce7; color: #166534">≥ 95%</span>
            <span>Excellent</span>
          </div>
          <div class="legend-row">
            <span class="legend-swatch" style="background-color: #fef08a; color: #713f12">85-94%</span>
            <span>Good</span>
          </div>
          <div class="legend-row">
            <span class="legend-swatch" style="background-color: #fecaca; color: #991b1b">&lt; 85%</span>
            <span>Below Target</span>
          </div>
        </div>
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

.conditional-legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.legend-section {
  padding: 12px;
  background-color: #f6f8fa;
  border-radius: 4px;
  border-left: 3px solid #0969da;
}

.legend-section h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #24292f;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.legend-swatch {
  display: inline-block;
  min-width: 50px;
  padding: 3px 6px;
  border-radius: 3px;
  font-weight: 500;
  text-align: center;
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
