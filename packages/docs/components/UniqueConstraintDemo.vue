<script setup lang="ts">
import { ref } from "vue";
import type { Schema, View, UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

interface Account {
  id: string;
  email: string;
  username: string;
  company: string;
  plan: string;
  status: string;
}

const tableRef = ref<ExtableVueHandle | null>(null);

const schema = {
  columns: [
    { key: "id", header: "Account ID", type: "string", readonly: true, width: 120, unique: true },
    {
      key: "email",
      header: "Email",
      type: "string",
      width: 200,
      unique: true,
    },
    {
      key: "username",
      header: "Username",
      type: "string",
      width: 150,
      unique: true,
    },
    { key: "company", header: "Company", type: "string", width: 150 },
    {
      key: "plan",
      header: "Plan",
      type: "enum",
      enum: { options: ["Free", "Pro", "Enterprise"] },
      width: 120,
    },
    {
      key: "status",
      header: "Status",
      type: "enum",
      enum: { options: ["Active", "Inactive", "Suspended"] },
      readonly: true,
      width: 120,
    },
  ],
} satisfies Schema;

const view = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

function generateAccountData(): Account[] {
  const plans = ["Free", "Pro", "Enterprise"];
  const statuses = ["Active", "Inactive", "Suspended"];
  const rows: Account[] = [];
  const duplicateEmails = ["user2@company2.com", "user7@company2.com", "user15@company0.com"];
  const duplicateUsernames = ["user_3", "user_8", "user_16"];
  
  // Create a pool of customer IDs that will be shuffled and repeated
  const customerIdPool = Array.from({ length: 15 }, (_, i) => `ACC-${String(i + 1).padStart(6, "0")}`);
  const shuffledIds: string[] = [];
  
  // Shuffle and extend the pool to cover 30 rows with duplicates
  for (let i = 0; i < 30; i++) {
    shuffledIds.push(customerIdPool[Math.floor(Math.random() * customerIdPool.length)]);
  }

  for (let i = 1; i <= 30; i++) {
    const email =
      i === 7 || i === 15
        ? duplicateEmails[0]
        : i === 2
          ? duplicateEmails[1]
          : `user${i}@company${i % 5}.com`;
    const username =
      i === 8 || i === 16
        ? duplicateUsernames[0]
        : i === 3
          ? duplicateUsernames[1]
          : `user_${i}`;

    rows.push({
      id: shuffledIds[i - 1],
      email,
      username,
      company: `Company ${Math.ceil(i / 3)}`,
      plan: plans[i % plans.length],
      status: statuses[i % statuses.length],
    });
  }
  return rows;
}

const defaultData = generateAccountData();
const user: UserInfo = { id: "demo-user", name: "Demo User" };
const validationMessage =
  "Try editing email or username columns to test unique constraint validation. Use the filter menu to explore data and find duplicate values with ease.";

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
      <strong>Unique Constraint:</strong> The Email and Username columns enforce uniqueness. Duplicate values are
      rejected, and custom validation rules check format/length requirements. Try editing to see validation in action.
    </div>

    <div class="validation-rules">
      <div class="rule-item">
        <span class="rule-icon">📧</span>
        <div class="rule-details">
          <div class="rule-title">Email</div>
          <div class="rule-desc">Must be unique and contain "@"</div>
        </div>
      </div>
      <div class="rule-item">
        <span class="rule-icon">👤</span>
        <div class="rule-details">
          <div class="rule-title">Username</div>
          <div class="rule-desc">Must be unique and at least 3 characters</div>
        </div>
      </div>
      <div class="rule-item">
        <span class="rule-icon">✓</span>
        <div class="rule-details">
          <div class="rule-title">Validation</div>
          <div class="rule-desc">Invalid entries display red cell outline</div>
        </div>
      </div>
    </div>

    <div class="validation-status">
      <small>{{ validationMessage }}</small>
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

.validation-rules {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background-color: #f6f8fa;
  border-radius: 4px;
  border-left: 3px solid #28a745;
  font-size: 12px;
}

.rule-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  font-size: 16px;
}

.rule-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rule-title {
  font-weight: 600;
  color: #24292f;
  font-size: 12px;
}

.rule-desc {
  color: #57606a;
  font-size: 11px;
}

.validation-status {
  padding: 8px 12px;
  background-color: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 4px;
  color: #166534;
  font-size: 12px;
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
