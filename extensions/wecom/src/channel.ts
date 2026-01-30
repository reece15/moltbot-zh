import {
  buildChannelConfigSchema,
  getChatChannelMeta,
  setAccountEnabledInConfigSection,
  deleteAccountFromConfigSection,
  normalizePluginHttpPath,
  registerPluginHttpRoute,
  type ChannelPlugin,
  type MoltbotConfig,
} from "moltbot/plugin-sdk";
import { WeComConfigSchema, type ResolvedWeComAccount, type WeComConfig } from "./types.js";
import { getWeComClient } from "./client.js";
import { handleWeComWebhook } from "./webhook.js";

const meta = getChatChannelMeta("wecom");

export const wecomPlugin: ChannelPlugin<ResolvedWeComAccount> = {
  id: "wecom",
  meta: {
    ...meta,
    name: "WeCom",
    description: "Enterprise WeChat (WeCom) channel",
    quickstartAllowFrom: false,
  },
  gateway: {
    startAccount: async ({ account, runtime }) => {
      console.log(`[WeCom] Starting account ${account.id} (corpid=${account.corpid})`);
      if (!account.token || !account.encodingAESKey) {
        console.log(`[WeCom] Missing token or encodingAESKey, skipping webhook registration`);
        return;
      }
      
      const path = "/wecom/webhook";
      console.log(`[WeCom] Registering webhook at ${path}`);

      registerPluginHttpRoute({
        path,
        pluginId: "wecom",
        accountId: account.id,
        log: (msg) => console.log(`[WeCom] ${msg}`),
        handler: async (req, res) => {
           console.log(`[WeCom] Handler invoked for ${req.url}`);
           await handleWeComWebhook(req, res, {
             token: account.token!,
             encodingAESKey: account.encodingAESKey!,
             corpid: account.corpid,
             corpsecret: account.corpsecret,
             agentid: String(account.agentid)
           });
        }
      });
    }
  },
  onboarding: {
     // TODO: Implement interactive onboarding
  },
  pairing: {
    idLabel: "wecomUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^wecom:/i, ""),
  },
  capabilities: {
    chatTypes: ["direct"],
    reactions: false,
    threads: false,
    media: false,
    nativeCommands: true,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.wecom"] },
  configSchema: buildChannelConfigSchema(WeComConfigSchema),
  config: {
    listAccountIds: (cfg: MoltbotConfig) => {
        const wecom = cfg.channels?.wecom as WeComConfig | undefined;
        const ids = Object.keys(wecom || {});
        if (process.env.WECOM_CORPID && process.env.WECOM_CORPSECRET && process.env.WECOM_AGENTID) {
            if (!ids.includes("env")) ids.push("env");
        }
        return ids;
    },
    resolveAccount: (cfg: MoltbotConfig, accountId: string) => {
        if (accountId === "env" && process.env.WECOM_CORPID) {
            return {
                id: "env",
                corpid: process.env.WECOM_CORPID,
                corpsecret: process.env.WECOM_CORPSECRET || "",
                agentid: process.env.WECOM_AGENTID || "",
                token: process.env.WECOM_TOKEN,
                encodingAESKey: process.env.WECOM_AESKEY,
                enabled: true
            };
        }
        const wecom = cfg.channels?.wecom as WeComConfig | undefined;
        const acc = wecom?.[accountId];
        if (!acc) return undefined;
        
        // Fallback to environment variables if not configured
        const token = acc.token || process.env.WECOM_TOKEN;
        const encodingAESKey = acc.encodingAESKey || process.env.WECOM_AESKEY;

        return { ...acc, id: accountId, token, encodingAESKey };
    },
    defaultAccountId: (cfg: MoltbotConfig) => {
        if (process.env.WECOM_CORPID) return "env";
        const wecom = cfg.channels?.wecom as WeComConfig | undefined;
        const keys = Object.keys(wecom || {});
        return keys.length > 0 ? keys[0] : undefined;
    },
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "wecom",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "wecom",
        accountId,
      }),
  },
  outbound: {
    sendText: async ({ cfg, accountId, to, text }) => {
       let account: ResolvedWeComAccount | undefined;
       if (accountId === "env" && process.env.WECOM_CORPID) {
            account = {
                id: "env",
                corpid: process.env.WECOM_CORPID,
                corpsecret: process.env.WECOM_CORPSECRET || "",
                agentid: process.env.WECOM_AGENTID || "",
                enabled: true
            };
       } else {
            const wecom = cfg.channels?.wecom as WeComConfig | undefined;
            const acc = wecom?.[accountId];
            if (acc) account = { ...acc, id: accountId };
       }

       if (!account) throw new Error(`WeCom account ${accountId} not found`);
       if (account.enabled === false) throw new Error(`WeCom account ${accountId} disabled`);
       
       const client = getWeComClient(account.corpid, account.corpsecret, account.agentid);
       await client.sendText(to, text);
       return { id: Date.now().toString() };
    }
  }
};
