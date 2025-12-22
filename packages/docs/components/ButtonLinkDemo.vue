<script setup lang="ts">
import { ref } from "vue";
import {
  defineSchema,
  type ButtonValue,
  type LinkValue,
  type SelectionChangeReason,
  type SelectionSnapshot,
  type UserInfo,
  type View,
} from "@extable/core";
import { Extable } from "@extable/vue";
import "@extable/core/style.css";

type ActionRow = {
  id: string;
  name: string;
  action: ButtonValue;
  link: LinkValue;
};

const schema = defineSchema<ActionRow>({
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 90 },
    { key: "name", header: "Item", type: "string", width: 180 },
    { key: "action", header: "Action", type: "button", width: 130, style: { align: "center" } },
    { key: "link", header: "Docs", type: "link", width: 220 },
  ],
});

const view = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

const data: ActionRow[] = [
  {
    id: "R-001",
    name: "Quarterly Report",
    action: { label: "Open", command: "open", commandfor: "report" },
    link: { label: "Spec", href: "https://example.com/specs/report" },
  },
  {
    id: "R-002",
    name: "Roadmap Draft",
    action: { label: "Review", command: "review", commandfor: "doc" },
    link: "https://example.com/docs/roadmap",
  },
  {
    id: "R-003",
    name: "Expense Sheet",
    action: "Approve",
    link: { label: "Template", href: "https://example.com/templates/expense" },
  },
];

const lastAction = ref<string>("None");
const user: UserInfo = { id: "docs-user", name: "Docs User" };

function handleCellEvent(
  next: SelectionSnapshot,
  _prev: SelectionSnapshot | null,
  reason: SelectionChangeReason,
) {
  if (reason !== "action" || !next.action) return;
  const value = next.action.value;
  const detail = value.command ? `${value.command} (${value.commandfor})` : "no command";
  lastAction.value = `"${value.label}" - ${detail}`;
}
</script>

<template>
  <div class="demo-container">
    <div class="demo-note">
      <strong>Button &amp; Link Cells:</strong> Buttons emit an action payload, while links navigate to
      URLs. Click the button text or press Space to trigger actions.
    </div>

    <div class="demo-table">
      <Extable
        :schema="schema"
        :defaultData="data"
        :defaultView="view"
        :options="{ user }"
        style="height: 260px; width: 100%"
        @cellEvent="handleCellEvent"
      />
    </div>

    <div class="demo-log">
      <span>Last Action:</span>
      <code>{{ lastAction }}</code>
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
}

.demo-table {
  height: 260px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  overflow: hidden;
}

.demo-log {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
}

.demo-log code {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 2px 6px;
}
</style>
