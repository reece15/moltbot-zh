import type { PluginRuntime } from "moltbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setWeComRuntime(r: PluginRuntime): void {
  runtime = r;
}

export function getWeComRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WeCom runtime not initialized - plugin not registered");
  }
  return runtime;
}
