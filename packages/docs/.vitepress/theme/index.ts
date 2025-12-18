import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import BasicUsageDemo from "../../components/BasicUsageDemo.vue";
import AsyncDataLoadingDemo from "../../components/AsyncDataLoadingDemo.vue";
import ReadonlyModeDemo from "../../components/ReadonlyModeDemo.vue";
import CommitModeDemo from "../../components/CommitModeDemo.vue";
import StyleDemo from "../../components/StyleDemo.vue";
import FormulasDemo from "../../components/FormulasDemo.vue";
import ConditionalStyleDemo from "../../components/ConditionalStyleDemo.vue";
import UniqueConstraintDemo from "../../components/UniqueConstraintDemo.vue";
import FilterSupportDemo from "../../components/FilterSupportDemo.vue";
import { enhanceAppWithTabs } from "vitepress-plugin-tabs/client";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    enhanceAppWithTabs(app);
    app.component("BasicUsageDemo", BasicUsageDemo);
    app.component("AsyncDataLoadingDemo", AsyncDataLoadingDemo);
    app.component("ReadonlyModeDemo", ReadonlyModeDemo);
    app.component("CommitModeDemo", CommitModeDemo);
    app.component("StyleDemo", StyleDemo);
    app.component("FormulasDemo", FormulasDemo);
    app.component("ConditionalStyleDemo", ConditionalStyleDemo);
    app.component("UniqueConstraintDemo", UniqueConstraintDemo);
    app.component("FilterSupportDemo", FilterSupportDemo);
  },
} satisfies Theme;
