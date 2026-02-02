import type { OpenClawConfig } from "./types.js";
import type { ModelDefinitionConfig } from "./types.models.js";
import { DEFAULT_CONTEXT_TOKENS } from "../agents/defaults.js";
import { parseModelRef } from "../agents/model-selection.js";
import { DEFAULT_AGENT_MAX_CONCURRENT, DEFAULT_SUBAGENT_MAX_CONCURRENT } from "./agent-limits.js";
import { resolveTalkApiKey } from "./talk.js";

type WarnState = { warned: boolean };

let defaultWarnState: WarnState = { warned: false };

type AnthropicAuthDefaultsMode = "api_key" | "oauth";

const DEFAULT_MODEL_ALIASES: Readonly<Record<string, string>> = {
  // Anthropic (pi-ai catalog uses "latest" ids without date suffix)
  opus: "anthropic/claude-opus-4-5",
  sonnet: "anthropic/claude-sonnet-4-5",

  // OpenAI
  gpt: "openai/gpt-5.2",
  "gpt-mini": "openai/gpt-5-mini",

  // Google Gemini (3.x are preview ids in the catalog)
  gemini: "google/gemini-3-pro-preview",
  "gemini-flash": "google/gemini-3-flash-preview",
};

const DEFAULT_MODEL_COST: ModelDefinitionConfig["cost"] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
const DEFAULT_MODEL_INPUT: ModelDefinitionConfig["input"] = ["text"];
const DEFAULT_MODEL_MAX_TOKENS = 8192;

type ModelDefinitionLike = Partial<ModelDefinitionConfig> &
  Pick<ModelDefinitionConfig, "id" | "name">;

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function resolveModelCost(
  raw?: Partial<ModelDefinitionConfig["cost"]>,
): ModelDefinitionConfig["cost"] {
  return {
    input: typeof raw?.input === "number" ? raw.input : DEFAULT_MODEL_COST.input,
    output: typeof raw?.output === "number" ? raw.output : DEFAULT_MODEL_COST.output,
    cacheRead: typeof raw?.cacheRead === "number" ? raw.cacheRead : DEFAULT_MODEL_COST.cacheRead,
    cacheWrite:
      typeof raw?.cacheWrite === "number" ? raw.cacheWrite : DEFAULT_MODEL_COST.cacheWrite,
  };
}

function resolveAnthropicDefaultAuthMode(cfg: OpenClawConfig): AnthropicAuthDefaultsMode | null {
  const profiles = cfg.auth?.profiles ?? {};
  const anthropicProfiles = Object.entries(profiles).filter(
    ([, profile]) => profile?.provider === "anthropic",
  );

  const order = cfg.auth?.order?.anthropic ?? [];
  for (const profileId of order) {
    const entry = profiles[profileId];
    if (!entry || entry.provider !== "anthropic") {
      continue;
    }
    if (entry.mode === "api_key") {
      return "api_key";
    }
    if (entry.mode === "oauth" || entry.mode === "token") {
      return "oauth";
    }
  }

  const hasApiKey = anthropicProfiles.some(([, profile]) => profile?.mode === "api_key");
  const hasOauth = anthropicProfiles.some(
    ([, profile]) => profile?.mode === "oauth" || profile?.mode === "token",
  );
  if (hasApiKey && !hasOauth) {
    return "api_key";
  }
  if (hasOauth && !hasApiKey) {
    return "oauth";
  }

  if (process.env.ANTHROPIC_OAUTH_TOKEN?.trim()) {
    return "oauth";
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return "api_key";
  }
  return null;
}

function resolvePrimaryModelRef(raw?: string): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const aliasKey = trimmed.toLowerCase();
  return DEFAULT_MODEL_ALIASES[aliasKey] ?? trimmed;
}

export type SessionDefaultsOptions = {
  warn?: (message: string) => void;
  warnState?: WarnState;
};

export function applyMessageDefaults(cfg: OpenClawConfig): OpenClawConfig {
  const messages = cfg.messages;
  const hasAckScope = messages?.ackReactionScope !== undefined;
  if (hasAckScope) {
    return cfg;
  }

  const nextMessages = messages ? { ...messages } : {};
  nextMessages.ackReactionScope = "group-mentions";
  return {
    ...cfg,
    messages: nextMessages,
  };
}

export function applySessionDefaults(
  cfg: OpenClawConfig,
  options: SessionDefaultsOptions = {},
): OpenClawConfig {
  const session = cfg.session;
  if (!session || session.mainKey === undefined) {
    return cfg;
  }

  const trimmed = session.mainKey.trim();
  const warn = options.warn ?? console.warn;
  const warnState = options.warnState ?? defaultWarnState;

  const next: OpenClawConfig = {
    ...cfg,
    session: { ...session, mainKey: "main" },
  };

  if (trimmed && trimmed !== "main" && !warnState.warned) {
    warnState.warned = true;
    warn('session.mainKey is ignored; main session is always "main".');
  }

  return next;
}

export function applyTalkApiKey(config: OpenClawConfig): OpenClawConfig {
  const resolved = resolveTalkApiKey();
  if (!resolved) {
    return config;
  }
  const existing = config.talk?.apiKey?.trim();
  if (existing) {
    return config;
  }
  return {
    ...config,
    talk: {
      ...config.talk,
      apiKey: resolved,
    },
  };
}

export function applyPrimaryModelFromEnv(cfg: OpenClawConfig): OpenClawConfig {
  const envModel = process.env.MOLTBOT_AGENTS_DEFAULTS_PRIMARY_MODEL?.trim();
  if (!envModel) return cfg;

  const defaults = cfg.agents?.defaults;
  const existingModel = defaults?.model;

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        model: {
          ...(typeof existingModel === "object" ? existingModel : undefined),
          primary: envModel,
        },
      },
    },
  };
}

export function applyGatewayEnv(cfg: OpenClawConfig): OpenClawConfig {
  const mode = process.env.GATEWAY_MODE?.trim();
  const portRaw = process.env.GATEWAY_PORT?.trim();
  const bind = process.env.GATEWAY_BIND?.trim();

  let nextGateway = { ...cfg.gateway };
  let modified = false;

  if (mode && !nextGateway.mode) {
    nextGateway.mode = mode as any;
    modified = true;
  }

  if (portRaw && nextGateway.port === undefined) {
    const port = Number.parseInt(portRaw, 10);
    if (Number.isFinite(port) && port > 0) {
      nextGateway.port = port;
      modified = true;
    }
  }

  if (bind && !nextGateway.bind) {
    nextGateway.bind = bind as any;
    modified = true;
  }

  if (!modified) return cfg;

  return {
    ...cfg,
    gateway: nextGateway,
  };
}

export function applySiliconFlowEnv(cfg: OpenClawConfig): OpenClawConfig {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim();
  if (!apiKey) return cfg;

  const existingProviders = cfg.models?.providers ?? {};
  // If already configured, don't override
  if (existingProviders.siliconflow) return cfg;

  const siliconFlowProvider = {
    baseUrl: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
    apiKey,
    api: "openai-completions",
    timeout: 120000,
    models: [
      {
        id: "deepseek-ai/DeepSeek-V3",
        name: "DeepSeek V3",
        reasoning: false,
        contextWindow: 64000,
        maxTokens: 8192,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
      {
        id: "deepseek-ai/DeepSeek-R1",
        name: "DeepSeek R1",
        reasoning: true,
        contextWindow: 64000,
        maxTokens: 8192,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
      {
        id: "Pro/zai-org/GLM-4.7",
        name: "GLM-4.7 Pro",
        contextWindow: 128000,
        maxTokens: 4096,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
    ],
  };

  return {
    ...cfg,
    models: {
      ...cfg.models,
      providers: {
        ...existingProviders,
        siliconflow: siliconFlowProvider as any,
      },
    },
  };
}

export function applyWeComEnv(cfg: OpenClawConfig): OpenClawConfig {
  const corpid = process.env.WECOM_CORPID?.trim() || process.env.WECOM_CORPID?.trim();
  const agentid = process.env.WECOM_AGENTID?.trim() || process.env.WECOM_AGENTID?.trim();
  const secret = process.env.WECOM_CORPSECRET?.trim() || process.env.WECOM_CORPSECRET?.trim();
  const token = process.env.WECOM_TOKEN?.trim();
  const aesKey = process.env.WECOM_AESKEY?.trim() || process.env.WECOM_AESKEY?.trim();

  if (!corpid || !agentid || !secret) return cfg;

  const existingWeCom = (cfg.channels?.wecom as Record<string, any>) || {};
  // If already configured, don't override
  if (existingWeCom["env"]) return cfg;

  const envAccount = {
    corpid,
    corpsecret: secret,
    agentid,
    token,
    encodingAESKey: aesKey,
    enabled: true,
  };

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      wecom: {
        ...existingWeCom,
        env: envAccount,
      },
    },
  };
}

export function applyWebSearchEnv(cfg: OpenClawConfig): OpenClawConfig {
  const provider = process.env.WEB_SEARCH_PROVIDER?.trim();
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  const braveKey = process.env.BRAVE_API_KEY?.trim();
  const perplexityKey = process.env.PERPLEXITY_API_KEY?.trim();

  // If none of the web search env vars are set, skip
  if (!provider && !tavilyKey && !braveKey && !perplexityKey) return cfg;

  const existingSearch = cfg.tools?.web?.search;
  // If already configured, don't override
  if (existingSearch) return cfg;

  const nextSearch: Record<string, any> = {};

  // Set provider if specified and valid
  if (provider && (provider === "tavily" || provider === "brave" || provider === "perplexity")) {
    nextSearch.provider = provider;
    nextSearch.enabled = true;
  }

  // Set Tavily config if key is present
  if (tavilyKey && !nextSearch.tavily?.apiKey) {
    nextSearch.tavily = {
      apiKey: tavilyKey,
    };
  }

  // Set Brave config if key is present
  if (braveKey && !nextSearch.apiKey) {
    nextSearch.apiKey = braveKey;
  }

  // Set Perplexity config if key is present
  if (perplexityKey && !nextSearch.perplexity?.apiKey) {
    nextSearch.perplexity = {
      ...nextSearch.perplexity,
      apiKey: perplexityKey,
    };
  }

  // If we have any API key, enable the tool
  if (tavilyKey || braveKey || perplexityKey) {
    nextSearch.enabled = true;
  }

  return {
    ...cfg,
    tools: {
      ...cfg.tools,
      web: {
        ...cfg.tools?.web,
        search: nextSearch,
      },
    },
  };
}

export function applyModelDefaults(cfg: OpenClawConfig): OpenClawConfig {
  let mutated = false;
  let nextCfg = cfg;

  const providerConfig = nextCfg.models?.providers;
  if (providerConfig) {
    const nextProviders = { ...providerConfig };
    for (const [providerId, provider] of Object.entries(providerConfig)) {
      const models = provider.models;
      if (!Array.isArray(models) || models.length === 0) {
        continue;
      }
      let providerMutated = false;
      const nextModels = models.map((model) => {
        const raw = model as ModelDefinitionLike;
        let modelMutated = false;

        const reasoning = typeof raw.reasoning === "boolean" ? raw.reasoning : false;
        if (raw.reasoning !== reasoning) {
          modelMutated = true;
        }

        const input = raw.input ?? [...DEFAULT_MODEL_INPUT];
        if (raw.input === undefined) {
          modelMutated = true;
        }

        const cost = resolveModelCost(raw.cost);
        const costMutated =
          !raw.cost ||
          raw.cost.input !== cost.input ||
          raw.cost.output !== cost.output ||
          raw.cost.cacheRead !== cost.cacheRead ||
          raw.cost.cacheWrite !== cost.cacheWrite;
        if (costMutated) {
          modelMutated = true;
        }

        const contextWindow = isPositiveNumber(raw.contextWindow)
          ? raw.contextWindow
          : DEFAULT_CONTEXT_TOKENS;
        if (raw.contextWindow !== contextWindow) {
          modelMutated = true;
        }

        const defaultMaxTokens = Math.min(DEFAULT_MODEL_MAX_TOKENS, contextWindow);
        const maxTokens = isPositiveNumber(raw.maxTokens) ? raw.maxTokens : defaultMaxTokens;
        if (raw.maxTokens !== maxTokens) {
          modelMutated = true;
        }

        if (!modelMutated) {
          return model;
        }
        providerMutated = true;
        return {
          ...raw,
          reasoning,
          input,
          cost,
          contextWindow,
          maxTokens,
        } as ModelDefinitionConfig;
      });

      if (!providerMutated) {
        continue;
      }
      nextProviders[providerId] = { ...provider, models: nextModels };
      mutated = true;
    }

    if (mutated) {
      nextCfg = {
        ...nextCfg,
        models: {
          ...nextCfg.models,
          providers: nextProviders,
        },
      };
    }
  }

  const existingAgent = nextCfg.agents?.defaults;
  if (!existingAgent) {
    return mutated ? nextCfg : cfg;
  }
  const existingModels = existingAgent.models ?? {};
  if (Object.keys(existingModels).length === 0) {
    return mutated ? nextCfg : cfg;
  }

  const nextModels: Record<string, { alias?: string }> = {
    ...existingModels,
  };

  for (const [alias, target] of Object.entries(DEFAULT_MODEL_ALIASES)) {
    const entry = nextModels[target];
    if (!entry) {
      continue;
    }
    if (entry.alias !== undefined) {
      continue;
    }
    nextModels[target] = { ...entry, alias };
    mutated = true;
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...nextCfg,
    agents: {
      ...nextCfg.agents,
      defaults: { ...existingAgent, models: nextModels },
    },
  };
}

export function applyAgentDefaults(cfg: OpenClawConfig): OpenClawConfig {
  const agents = cfg.agents;
  const defaults = agents?.defaults;
  const hasMax =
    typeof defaults?.maxConcurrent === "number" && Number.isFinite(defaults.maxConcurrent);
  const hasSubMax =
    typeof defaults?.subagents?.maxConcurrent === "number" &&
    Number.isFinite(defaults.subagents.maxConcurrent);
  if (hasMax && hasSubMax) {
    return cfg;
  }

  let mutated = false;
  const nextDefaults = defaults ? { ...defaults } : {};
  if (!hasMax) {
    nextDefaults.maxConcurrent = DEFAULT_AGENT_MAX_CONCURRENT;
    mutated = true;
  }

  const nextSubagents = defaults?.subagents ? { ...defaults.subagents } : {};
  if (!hasSubMax) {
    nextSubagents.maxConcurrent = DEFAULT_SUBAGENT_MAX_CONCURRENT;
    mutated = true;
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...agents,
      defaults: {
        ...nextDefaults,
        subagents: nextSubagents,
      },
    },
  };
}

export function applyLoggingDefaults(cfg: OpenClawConfig): OpenClawConfig {
  const logging = cfg.logging;
  if (!logging) {
    return cfg;
  }
  if (logging.redactSensitive) {
    return cfg;
  }
  return {
    ...cfg,
    logging: {
      ...logging,
      redactSensitive: "tools",
    },
  };
}

export function applyContextPruningDefaults(cfg: OpenClawConfig): OpenClawConfig {
  const defaults = cfg.agents?.defaults;
  if (!defaults) {
    return cfg;
  }

  const authMode = resolveAnthropicDefaultAuthMode(cfg);
  if (!authMode) {
    return cfg;
  }

  let mutated = false;
  const nextDefaults = { ...defaults };
  const contextPruning = defaults.contextPruning ?? {};
  const heartbeat = defaults.heartbeat ?? {};

  if (defaults.contextPruning?.mode === undefined) {
    nextDefaults.contextPruning = {
      ...contextPruning,
      mode: "cache-ttl",
      ttl: defaults.contextPruning?.ttl ?? "1h",
    };
    mutated = true;
  }

  if (defaults.heartbeat?.every === undefined) {
    nextDefaults.heartbeat = {
      ...heartbeat,
      every: authMode === "oauth" ? "1h" : "30m",
    };
    mutated = true;
  }

  if (authMode === "api_key") {
    const nextModels = defaults.models ? { ...defaults.models } : {};
    let modelsMutated = false;

    for (const [key, entry] of Object.entries(nextModels)) {
      const parsed = parseModelRef(key, "anthropic");
      if (!parsed || parsed.provider !== "anthropic") {
        continue;
      }
      const current = entry ?? {};
      const params = (current as { params?: Record<string, unknown> }).params ?? {};
      if (typeof params.cacheControlTtl === "string") {
        continue;
      }
      nextModels[key] = {
        ...(current as Record<string, unknown>),
        params: { ...params, cacheControlTtl: "1h" },
      };
      modelsMutated = true;
    }

    const primary = resolvePrimaryModelRef(defaults.model?.primary ?? undefined);
    if (primary) {
      const parsedPrimary = parseModelRef(primary, "anthropic");
      if (parsedPrimary?.provider === "anthropic") {
        const key = `${parsedPrimary.provider}/${parsedPrimary.model}`;
        const entry = nextModels[key];
        const current = entry ?? {};
        const params = (current as { params?: Record<string, unknown> }).params ?? {};
        if (typeof params.cacheControlTtl !== "string") {
          nextModels[key] = {
            ...(current as Record<string, unknown>),
            params: { ...params, cacheControlTtl: "1h" },
          };
          modelsMutated = true;
        }
      }
    }

    if (modelsMutated) {
      nextDefaults.models = nextModels;
      mutated = true;
    }
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: nextDefaults,
    },
  };
}

export function applyCompactionDefaults(cfg: OpenClawConfig): OpenClawConfig {
  const defaults = cfg.agents?.defaults;
  if (!defaults) {
    return cfg;
  }
  const compaction = defaults?.compaction;
  if (compaction?.mode) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        compaction: {
          ...compaction,
          mode: "safeguard",
        },
      },
    },
  };
}

export function resetSessionDefaultsWarningForTests() {
  defaultWarnState = { warned: false };
}
