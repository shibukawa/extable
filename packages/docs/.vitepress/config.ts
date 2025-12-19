import { defineConfig } from "vitepress";
import { tabsMarkdownPlugin } from "vitepress-plugin-tabs";

export default defineConfig({
  lang: "en-US",
  title: "Extable",
  description: "Excel-like HTML table component with fixed column schema",
  base: process.env.BASE_PATH ?? "/",
  cleanUrls: true,
  markdown: {
    config(md) {
      md.use(tabsMarkdownPlugin);
    },
  },
  themeConfig: {
    nav: [
      { text: "Concepts", link: "/concepts/" },
      { text: "Guides", link: "/guides/integration" },
      { text: "Usage", link: "/usage/editing" },
      { text: "Demos", link: "/demos/" },
      { text: "Reference", link: "/reference/core" },
      {
        text: "GitHub",
        link: "https://github.com/shibukawa/extable",
        target: "_blank",
        rel: "noopener noreferrer",
      },
    ],
    footer: {
      message: "Released under the Apache 2.0 License",
      copyright: "Copyright 2025 Yoshiki Shibukawa",
    },
    sidebar: {
      "/concepts/": [
        { text: "Extable Design Concept", link: "/concepts/" },
        { text: "Uncontrolled Model", link: "/concepts/uncontrolled" },
        { text: "Differences from Excel", link: "/concepts/differences-from-excel" },
        { text: "Rendering Modes", link: "/concepts/rendering-modes" },
        { text: "Data / Schema / View", link: "/concepts/data-schema-view" },
        { text: "IME Input Handling", link: "/concepts/ime" },
        { text: "Multi-user (Preview)", link: "/concepts/multi-user" },
      ],
      "/guides/": [
        { text: "Integration", link: "/guides/integration" },
        { text: "Data Format", link: "/guides/data-format" },
        { text: "Edit Modes", link: "/guides/editmode" },
        { text: "Data Access from API", link: "/guides/data-access" },
        { text: "Validation", link: "/guides/validation" },
        { text: "Style", link: "/guides/style" },
        { text: "Formulas", link: "/guides/formulas" },
        { text: "Conditional Style", link: "/guides/conditional-style" },
        { text: "Unit Testing", link: "/guides/unit-testing" },
      ],
      "/usage/": [
        { text: "Editing", link: "/usage/editing" },
        { text: "Sort & Filter", link: "/usage/sort-filter" },
        { text: "Search", link: "/usage/search" },
      ],
      "/demos/": [
        { text: "Overview", link: "/demos/" },
        { text: "Basic Usage (Direct Mode)", link: "/demos/basic-usage" },
        { text: "Auto Fill", link: "/demos/auto-fill-sequence" },
        { text: "Async Data Loading", link: "/demos/async-data-loading" },
        { text: "Readonly Mode", link: "/demos/readonly-mode" },
        { text: "Commit Mode", link: "/demos/commit-mode" },
        { text: "Formatting", link: "/demos/formatting" },
        { text: "Formula", link: "/demos/formulas" },
        { text: "Conditional Style", link: "/demos/conditional-style" },
        { text: "Unique Constraint", link: "/demos/unique-constraint" },
        { text: "Filter/Sort", link: "/demos/filter-support" },
      ],
      "/reference/": [{ text: "Core API", link: "/reference/core" }],
    },
  },
});
