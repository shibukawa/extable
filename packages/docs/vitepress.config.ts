import { defineConfig } from "vitepress";
import { tabsMarkdownPlugin } from "vitepress-plugin-tabs";

export default defineConfig({
  lang: "en-US",
  title: "extable",
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
      { text: "Concepts", link: "/concepts/uncontrolled" },
      { text: "Guides", link: "/guides/core" },
      { text: "Usage", link: "/usage/sort-filter" },
      { text: "Demos", link: "/demos/" },
      { text: "Reference", link: "/reference/core" },
    ],
    sidebar: {
      "/concepts/": [
        { text: "Uncontrolled Model", link: "/concepts/uncontrolled" },
        { text: "Differences from Excel", link: "/concepts/differences-from-excel" },
        { text: "Rendering Modes", link: "/concepts/rendering-modes" },
        { text: "Data / Schema / View", link: "/concepts/data-schema-view" },
        { text: "IME Input Handling", link: "/concepts/ime" },
        { text: "Multi-user (Preview)", link: "/concepts/multi-user" },
      ],
      "/guides/": [
        { text: "Vanilla", link: "/guides/core" },
        { text: "React", link: "/guides/react" },
        { text: "Vue", link: "/guides/vue" },
        { text: "Data Format", link: "/guides/data-format" },
        { text: "Edit Modes", link: "/guides/editmode" },
        { text: "Loading Data", link: "/guides/loading" },
        { text: "Getting Data", link: "/guides/getting-data-in-table" },
        { text: "Validation", link: "/guides/validation" },
        { text: "Styling", link: "/guides/styling" },
        { text: "Formulas", link: "/guides/formulas" },
        { text: "Conditional Formatting", link: "/guides/conditional-formatting" },
        { text: "Callbacks", link: "/guides/callbacks" },
        { text: "Unit Testing", link: "/guides/unit-testing" },
      ],
      "/usage/": [
        { text: "Sort & Filter", link: "/usage/sort-filter" },
        { text: "Editing", link: "/usage/editing" },
      ],
      "/demos/": [
        { text: "Overview", link: "/demos/" },
        { text: "Basic Usage", link: "/demos/basic-usage" },
        { text: "SSR vs Client Rendering", link: "/demos/ssr-compare" },
        { text: "Auto-fill Sequences", link: "/demos/auto-fill-sequence" },
        { text: "Button & Link Cells", link: "/demos/button-link" },
        { text: "Conditional Readonly/Disabled", link: "/demos/conditional-access" },
        { text: "Unique Boolean (Radio)", link: "/demos/unique-bool" },
        { text: "Vanilla Demo", link: "/demos/vanilla" },
        { text: "React Demo", link: "/demos/react" },
        { text: "Vue Demo", link: "/demos/vue" },
        { text: "Embedded Vue Demo", link: "/demos/embedded-vue" },
      ],
      "/reference/": [
        { text: "Init Options", link: "/reference/init-options" },
        { text: "Core API", link: "/reference/core" },
        { text: "SSR", link: "/reference/ssr" },
        { text: "Events", link: "/reference/events" },
        { text: "React API", link: "/reference/react" },
        { text: "Vue API", link: "/reference/vue" },
      ],
    },
  },
});
