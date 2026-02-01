import type { MoltbotPluginApi } from "moltbot/plugin-sdk";
import { emptyPluginConfigSchema } from "moltbot/plugin-sdk";

import { wecomPlugin } from "./src/channel.js";
import { setWeComRuntime } from "./src/runtime.js";

const plugin = {
  id: "wecom",
  name: "WeCom",
  description: "Enterprise WeChat (WeCom) channel plugin",
  meta: {
    quickstartAllowFrom: true,
  },
  configSchema: emptyPluginConfigSchema(),
  register(api: MoltbotPluginApi) {
    setWeComRuntime(api.runtime);
    api.registerChannel({ plugin: wecomPlugin });
  },
};

export default plugin;
