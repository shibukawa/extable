import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import EmbeddedVueDemo from "../../components/EmbeddedVueDemo.vue";
import BasicUsageDemo from "../../components/BasicUsageDemo.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("EmbeddedVueDemo", EmbeddedVueDemo);
    app.component("BasicUsageDemo", BasicUsageDemo);
  },
} satisfies Theme;
