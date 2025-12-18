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
import HomeLayout from "./layouts/home.vue";

export default {
  extends: DefaultTheme,
  layouts: {
    home: HomeLayout,
  },
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

    // Inject hero screenshot background style
    const id = "extable-hero-screenshot";
    if (typeof window !== "undefined" && !document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `.VPHero .main::after{content:'';position:absolute;right:0;top:0;width:50%;height:100%;background-image:url('https://github.com/shibukawa/extable/blob/main/packages/docs/public/assets/screenshot.webp?raw=true');background-size:contain;background-repeat:no-repeat;background-position:right center;pointer-events:none;filter:drop-shadow(0 10px 40px rgba(0,0,0,0.12))}`;
      document.head.appendChild(s);
    }
  },
} satisfies Theme;
