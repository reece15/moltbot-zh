import type { OpenClawConfig } from "../config/config.js";
import {
  buildSiliconFlowModelDefinition,
  SILICONFLOW_BASE_URL,
  SILICONFLOW_DEFAULT_MODEL_ID,
  SILICONFLOW_DEFAULT_MODEL_REF,
} from "./onboard-auth.models.js";

export function applySiliconFlowProviderConfig(cfg: OpenClawConfig): OpenClawConfig {
  const models = { ...cfg.agents?.defaults?.models };

  // Set default model if needed, or just aliases
  models[SILICONFLOW_DEFAULT_MODEL_REF] = {
    ...models[SILICONFLOW_DEFAULT_MODEL_REF],
    alias: models[SILICONFLOW_DEFAULT_MODEL_REF]?.alias ?? "SiliconFlow",
  };

  const providers = { ...cfg.models?.providers };

  if (!providers.siliconflow) {
    providers.siliconflow = {
      baseUrl: SILICONFLOW_BASE_URL,
      apiKey: "siliconflow",
      api: "openai-completions",
      models: [
        buildSiliconFlowModelDefinition({
          id: "Pro/zai-org/GLM-4.7",
          name: "GLM-4.7 Pro",
          contextWindow: 128000,
          maxTokens: 4096,
        }),
        buildSiliconFlowModelDefinition({
          id: "deepseek-ai/DeepSeek-V3.2",
          name: "DeepSeek V3.2",
          reasoning: true,
          contextWindow: 64000,
          maxTokens: 8192,
        }),
        buildSiliconFlowModelDefinition({
          id: "Pro/MiniMaxAI/MiniMax-M2.1",
          name: "MiniMax M2.1 Pro",
          contextWindow: 128000,
          maxTokens: 8192,
        }),
        buildSiliconFlowModelDefinition({
          id: "moonshotai/Kimi-K2-Thinking",
          name: "Kimi K2 Thinking",
          reasoning: true,
          contextWindow: 128000,
          maxTokens: 8192,
        }),
        // Also add the default/fallback if not in list
        buildSiliconFlowModelDefinition({
          id: SILICONFLOW_DEFAULT_MODEL_ID,
          name: "MiniMax M2.1 Pro (Default)",
          reasoning: false,
        }),
      ],
    };
  }

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models,
      },
    },
    models: {
      mode: cfg.models?.mode ?? "merge",
      providers,
    },
  };
}

export function applySiliconFlowConfig(cfg: OpenClawConfig): OpenClawConfig {
  // Update agent defaults to use SiliconFlow
  const updated = applySiliconFlowProviderConfig(cfg);

  return {
    ...updated,
    agents: {
      ...updated.agents,
      defaults: {
        ...updated.agents?.defaults,
        model: {
          primary: SILICONFLOW_DEFAULT_MODEL_REF,
        },
      },
    },
  };
}
