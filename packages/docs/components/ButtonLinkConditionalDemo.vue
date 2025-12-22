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

type AccessRow = {
  id: string;
  title: string;
  score: number;
  edit: boolean;
  action: ButtonValue;
  link: LinkValue;
};

const readonlyWhenLocked = (row: AccessRow) => (row.edit ? null : { readonly: true });
const disabledWhenLocked = (row: AccessRow) => (row.edit ? null : { disabled: true });

const schema = defineSchema<AccessRow>({
  columns: [
    {
      key: "edit",
      header: "Edit",
      type: "boolean",
      format: "checkbox",
      width: 80,
      style: { align: "center" },
    },
    { key: "id", header: "ID", type: "string", readonly: true, width: 90 },
    {
      key: "title",
      header: "Title",
      type: "string",
      width: 200,
      conditionalStyle: readonlyWhenLocked,
    },
    {
      key: "score",
      header: "Score",
      type: "number",
      width: 110,
      style: { align: "right" },
      conditionalStyle: readonlyWhenLocked,
    },
    {
      key: "action",
      header: "Action",
      type: "button",
      width: 130,
      style: { align: "center" },
      conditionalStyle: disabledWhenLocked,
    },
    {
      key: "link",
      header: "Link",
      type: "link",
      width: 200,
      conditionalStyle: disabledWhenLocked,
    },
  ],
});

const view = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

const data: AccessRow[] = [
  {
    edit: true,
    id: "A-101",
    title: "Budget Sheet",
    score: 82,
    action: { label: "Review", command: "review", commandfor: "budget" },
    link: "https://example.com/budget",
  },
  {
    edit: false,
    id: "A-102",
    title: "Hiring Plan",
    score: 91,
    action: { label: "Open", command: "open", commandfor: "plan" },
    link: { label: "Policy", href: "https://example.com/policy" },
  },
  {
    edit: true,
    id: "A-103",
    title: "Release Checklist",
    score: 74,
    action: "Approve",
    link: { label: "Checklist", href: "https://example.com/checklist" },
  },
  {
    edit: false,
    id: "A-104",
    title: "Incident Report",
    score: 68,
    action: { label: "Inspect", command: "inspect", commandfor: "incident" },
    link: "https://example.com/incidents",
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
      <strong>Conditional Access:</strong> Toggle the <em>Edit</em> checkbox. When Edit is off, text and
      numbers become readonly, and buttons/links are disabled.
    </div>

    <div class="demo-table">
      <Extable
        class="demo-extable"
        :schema="schema"
        :defaultData="data"
        :defaultView="view"
        :options="{ user }"
        style="height: 300px"
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
  background-color: #fef9c3;
  border: 1px solid #f59e0b;
  border-radius: 4px;
}

.demo-table {
  height: 300px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  overflow: auto;
}

.demo-extable {
  width: max-content;
  min-width: 100%;
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
