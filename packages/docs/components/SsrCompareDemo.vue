<script setup lang="ts">
import type { CoreOptions } from "@extable/core";
import { renderTableHTML } from "@extable/core/ssr";
import { Extable } from "@extable/vue";
import { defaultEmployeeView, employeeSchema, generateEmployeeData, type DemoEmployee } from "./demoDataGenerators";
import "@extable/core/style.css";

const rowCount = 20;
const baseData = generateEmployeeData(rowCount);
const sharedJson = JSON.stringify(baseData);

const ssrData = JSON.parse(sharedJson) as DemoEmployee[];
const htmlData = JSON.parse(sharedJson) as DemoEmployee[];
const canvasData = JSON.parse(sharedJson) as DemoEmployee[];

const ssrResult = renderTableHTML({
  data: ssrData,
  schema: employeeSchema,
  cssMode: "inline",
  wrapWithRoot: true,
  defaultClass: "extable-ssr",
  defaultStyle: { height: "100%", width: "100%" },
  includeStyles: true,
});

const ssrHtml = ssrResult.html.includes("extable-root")
  ? ssrResult.html
  : `<div class="extable-root extable-ssr" style="height:100%;width:100%;"><div class="extable-shell"><div class="extable-viewport">${ssrResult.html}</div><div class="extable-overlay-layer"></div></div></div>`;

const htmlOptions: CoreOptions = { renderMode: "html" };
const canvasOptions: CoreOptions = { renderMode: "canvas" };
</script>

<template>
  <div class="demo-compare">
    <section class="demo-panel">
      <div class="demo-title">Static HTML (SSR output)</div>
      <p class="demo-desc">
        Generated with <code>renderTableHTML</code> from the same JSON. This is static HTML only.
      </p>
      <div class="demo-table demo-table-ssr" v-html="ssrHtml"></div>
    </section>

    <section class="demo-panel">
      <div class="demo-title">HTML Mode (Client render)</div>
      <p class="demo-desc">
        Client-side render in HTML mode. The client rebuilds the DOM on mount.
      </p>
      <div class="demo-table demo-table-client">
        <Extable
          :schema="employeeSchema"
          :defaultData="htmlData"
          :defaultView="defaultEmployeeView"
          :options="htmlOptions"
          style="height: 100%; width: 100%"
        />
      </div>
    </section>

    <section class="demo-panel">
      <div class="demo-title">Canvas Mode (Client render)</div>
      <p class="demo-desc">
        Same data and schema rendered with the canvas renderer.
      </p>
      <div class="demo-table demo-table-client">
        <Extable
          :schema="employeeSchema"
          :defaultData="canvasData"
          :defaultView="defaultEmployeeView"
          :options="canvasOptions"
          style="height: 100%; width: 100%"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.demo-compare {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 20px 0;
}

.demo-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #f6f8fa;
}

.demo-title {
  font-size: 14px;
  font-weight: 600;
  color: #24292f;
}

.demo-desc {
  margin: 0;
  font-size: 12px;
  color: #57606a;
}

.demo-table {
  border: 1px solid #d0d7de;
  background: #ffffff;
}

.demo-table-ssr {
  height: 320px;
  overflow: auto;
}

.demo-table-client {
  height: 320px;
}

.demo-table-ssr .extable-root {
  width: 100%;
  height: 100%;
}

.demo-table-ssr .extable-shell,
.demo-table-ssr .extable-viewport {
  width: 100%;
  height: 100%;
}

.demo-table-ssr :deep(table[data-extable-renderer="html"] tbody tr) {
  background: transparent;
}
</style>
