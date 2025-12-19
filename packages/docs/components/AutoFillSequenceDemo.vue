<script setup lang="ts">
import { computed } from "vue";
import { defineSchema } from "@extable/core";
import type { View } from "@extable/core";
import { Extable } from "@extable/vue";
import "@extable/core/style.css";

interface DemoRow {
  number: number | null;
  stringNumber: string;
  ordinal: string;
  roman: string;
  greek: string;
  sequence: string;
  month: string;
  zodiac: string;
  planet: string;
  finite: string;
}

const props = defineProps<{
  lang: "en" | "ja";
}>();


const schema = defineSchema<DemoRow>({
  columns: [
    { key: "number", header: "Number", type: "number", width: 80 },
    { key: "stringNumber", header: "String + Number", type: "string", width: 130 },
    { key: "ordinal", header: "Ordinal", type: "string", width: 110 },
    { key: "roman", header: "Roman", type: "string", width: 90 },
    { key: "greek", header: "Greek", type: "string", width: 120 },
    { key: "sequence", header: "Sequence", type: "string", width: 140 },
    { key: "month", header: "Month", type: "string", width: 120 },
    { key: "zodiac", header: "Zodiac", type: "string", width: 140 },
    { key: "planet", header: "Planet", type: "string", width: 120 },
    { key: "finite", header: "Finite", type: "string", width: 140 },
  ],
});

const view = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

const enOptions = { langs: ["en"] };
const jaOptions = { langs: ["ja", "en"] };

const createBlankRow = (): DemoRow => ({
  number: null,
  stringNumber: "",
  ordinal: "",
  roman: "",
  greek: "",
  sequence: "",
  month: "",
  zodiac: "",
  planet: "",
  finite: "",
});

const enData = computed<DemoRow[]>(() => {
  const rows = Array.from({ length: 50 }, () => createBlankRow());
  rows[0] = {
    number: 10,
    stringNumber: "User 1",
    ordinal: "1st",
    roman: "I",
    greek: "Alpha",
    sequence: "Monday",
    month: "Jan",
    zodiac: "Aries",
    planet: "Mercury",
    finite: "Mercury",
  };
  rows[1] = {
    number: 20,
    stringNumber: "User 2",
    ordinal: "2nd",
    roman: "II",
    greek: "Beta",
    sequence: "Tuesday",
    month: "Feb",
    zodiac: "Taurus",
    planet: "Venus",
    finite: "Venus",
  };
  return rows;
});

const jaData = computed<DemoRow[]>(() => {
  const rows = Array.from({ length: 50 }, () => createBlankRow());
  rows[0] = {
    number: 1,
    stringNumber: "第1回",
    ordinal: "1st",
    roman: "I",
    greek: "α",
    sequence: "1月",
    month: "睦月",
    zodiac: "牡羊座",
    planet: "水星",
    finite: "甲",
  };
  rows[1] = {
    number: 2,
    stringNumber: "第2回",
    ordinal: "2nd",
    roman: "II",
    greek: "β",
    sequence: "2月",
    month: "如月",
    zodiac: "牡牛座",
    planet: "金星",
    finite: "乙",
  };
  return rows;
});
const demoTitle = computed(() =>
  props.lang === "en" ? 'English only (langs: ["en"])' : 'Japanese + English (langs: ["ja", "en"])'
);
const demoHint = computed(() =>
  props.lang === "en"
    ? "Select the first two rows in any column and drag the fill handle downward."
    : "Japanese sequences and Greek symbols are available with ja + en preference."
);
const demoData = computed(() => (props.lang === "en" ? enData.value : jaData.value));
const demoOptions = computed(() => (props.lang === "en" ? enOptions : jaOptions));

</script>

<template>
  <div class="demo-stack">
    <section class="demo-block">
      <h3>{{ demoTitle }}</h3>
      <p class="demo-hint">{{ demoHint }}</p>
      <div class="demo-table">
        <Extable
          class="demo-extable"
          :schema="schema"
          :defaultData="demoData"
          :defaultView="view"
          :options="demoOptions"
        style="height: 100%; width: 100%"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.demo-stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 20px 0;
}

.demo-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.demo-hint {
  margin: 0;
  font-size: 13px;
  color: #57606a;
}

.demo-table {
  height: 320px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  overflow: auto;
}

.demo-extable {
  width: max-content;
}
</style>
