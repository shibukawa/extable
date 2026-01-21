<script setup lang="ts">
import { ref } from "vue";
import type { Schema, View, UserInfo } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

interface Row { id: number; name: string; primary: boolean }

const tableRef = ref<ExtableVueHandle | null>(null);

const schema = {
  columns: [
    { key: 'id', header: '#', type: 'number', readonly: true, width: 60 },
    { key: 'name', header: 'Name', type: 'string', width: 200 },
    { key: 'primary', header: 'Primary', type: 'boolean', unique: true, width: 120 },
  ],
} satisfies Schema;

const view = { hiddenColumns: [], filters: [], sorts: [] } satisfies View;

const defaultData: Row[] = [
  { id: 1, name: 'Alpha', primary: false },
  { id: 2, name: 'Bravo', primary: true },
  { id: 3, name: 'Charlie', primary: false },
  { id: 4, name: 'Delta', primary: false },
];

const user: UserInfo = { id: 'demo-user', name: 'Demo User' };

function handleUndo() { tableRef.value?.undo(); }
function handleRedo() { tableRef.value?.redo(); }
</script>

<template>
  <div class="demo-container">
    <div class="demo-note">
      Select the radio in the "Primary" column to mark exactly one row as primary; the selected row is highlighted.
    </div>
    <div class="demo-controls">
      <div class="edit-controls">
        <button @click="handleUndo">↶ Undo</button>
        <button @click="handleRedo">↷ Redo</button>
      </div>
    </div>
    <div class="demo-table" style="height: 300px; border: 1px solid #d0d7de; overflow: visible">
      <Extable
        ref="tableRef"
        :schema="schema"
        :defaultData="defaultData"
        :defaultView="view"
        :options="{ user }"
        style="height:100%;width:100%"
      />
    </div>
  </div>
</template>

<style scoped>
.demo-container { display:flex; flex-direction:column; gap:12px; }
.demo-note { padding:10px; background:#eef6ff; border:1px solid #cce4ff; border-radius:6px; }
.demo-controls { display:flex; }
.edit-controls { margin-left:auto; display:flex; gap:8px; }
button { padding:4px 8px; border:1px solid #d0d7de; border-radius:4px; background:white; cursor:pointer }
</style>
