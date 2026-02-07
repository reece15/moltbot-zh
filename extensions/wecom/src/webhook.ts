import type { IncomingMessage, ServerResponse } from "node:http";
import { WeComCrypto } from "./wxcrypto.js";
import { getWeComClient } from "./client.js";
import type { ReplyPayload } from "openclaw/plugin-sdk";
import { getWeComRuntime } from "./runtime.js";

// Cache for deduplicating messages (MsgId -> timestamp)
const processedMsgIds = new Map<string, number>();
const MSG_ID_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupMsgIdCache() {
  const now = Date.now();
  for (const [id, timestamp] of processedMsgIds.entries()) {
    if (now - timestamp > MSG_ID_TTL_MS) {
      processedMsgIds.delete(id);
    }
  }
}

// Cleanup every hour
setInterval(cleanupMsgIdCache, 60 * 60 * 1000);

function getQuery(req: IncomingMessage): URLSearchParams {
  const url = req.url || "";
  const q = url.split("?")[1] || "";
  return new URLSearchParams(q);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function extractXmlField(xml: string, field: string): string | undefined {
  // Allow whitespace around CDATA or content
  const regex = new RegExp(`<${field}>(?:\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*|([\\s\\S]*?))<\\/${field}>`);
  const match = xml.match(regex);
  return match ? (match[1] || match[2]) : undefined;
}

export async function handleWeComWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  params: {
    token: string;
    encodingAESKey: string;
    corpid: string;
    corpsecret: string;
    agentid: string;
    blockStreaming?: boolean;
  }
) {
  const query = getQuery(req);
  const msgSignature = query.get("msg_signature");
  const timestamp = query.get("timestamp");
  const nonce = query.get("nonce");
  const echostr = query.get("echostr");

  if (!msgSignature || !timestamp || !nonce) {
    res.statusCode = 400;
    res.end("Missing signature parameters");
    return;
  }

  const crypto = new WeComCrypto(params.token, params.encodingAESKey, params.corpid);

  console.log(`[WeCom] Received request: ${req.method} ${req.url}`);
  console.log(`[WeCom] Params: msg_signature=${msgSignature}, timestamp=${timestamp}, nonce=${nonce}, echostr=${echostr}`);

  // Verification request (GET)
  if (req.method === "GET" && echostr) {
    const signature = crypto.getSignature(timestamp, nonce, echostr);
    console.log(`[WeCom] Calculated signature: ${signature}`);
    
    if (signature !== msgSignature) {
      console.error(`[WeCom] Signature mismatch! Expected: ${msgSignature}, Calculated: ${signature}`);
      res.statusCode = 403;
      res.end("Invalid signature");
      return;
    }

    try {
      const { message } = crypto.decrypt(echostr);
      console.log(`[WeCom] Decrypted echostr: ${message}`);
      res.statusCode = 200;
      res.end(message);
    } catch (err) {
      console.error(`[WeCom] Decryption failed: ${String(err)}`);
      res.statusCode = 403;
      res.end("Decryption failed");
    }
    return;
  }

  // Message request (POST)
  if (req.method === "POST") {
    const body = await readBody(req);
    console.log(`[WeCom] POST body length: ${body.length}`);
    
    const encrypt = extractXmlField(body, "Encrypt");

    if (!encrypt) {
      console.error("[WeCom] Missing Encrypt field in XML");
      res.statusCode = 400;
      res.end("Missing Encrypt field");
      return;
    }

    const signature = crypto.getSignature(timestamp, nonce, encrypt);
    console.log(`[WeCom] POST Calculated signature: ${signature}`);

    if (signature !== msgSignature) {
      console.error(`[WeCom] Signature mismatch! Expected: ${msgSignature}, Calculated: ${signature}`);
      res.statusCode = 403;
      res.end("Invalid signature");
      return;
    }

    try {
      const { message: decryptedXml } = crypto.decrypt(encrypt);
      console.log(`[WeCom] Decrypted message: ${decryptedXml}`);
      
      let content = extractXmlField(decryptedXml, "Content");
      const fromUser = extractXmlField(decryptedXml, "FromUserName");
      const msgType = extractXmlField(decryptedXml, "MsgType");
      const msgId = extractXmlField(decryptedXml, "MsgId");

      // Trim content to handle leading/trailing newlines or spaces (e.g. from XML formatting or user input)
      if (content) {
        content = content.trim();
      }

      if (msgType !== "text" || !content || !fromUser) {
          console.log("[WeCom] Ignored non-text message or missing fields");
          res.statusCode = 200;
          res.end("success");
          return;
      }

      // Deduplication check
      if (msgId && processedMsgIds.has(msgId)) {
        console.log(`[WeCom] Duplicate message ignored (MsgId: ${msgId})`);
        res.statusCode = 200;
        res.end("success");
        return;
      }

      if (msgId) {
        processedMsgIds.set(msgId, Date.now());
      }

      // Send response immediately to prevent WeCom retries
      res.statusCode = 200;
      res.end("success");

      // Initialize Client
      const client = getWeComClient(params.corpid, params.corpsecret, params.agentid);

      // Dispatch to Moltbot
      const runtime = getWeComRuntime();
      const config = runtime.config.loadConfig();
      
      const agentId = "default"; // Default agent

      const ctxPayload = {
          From: fromUser,
          Body: content,
          channel: "wecom",
          CommandAuthorized: true, // Allow slash commands from authenticated WeCom users
          channelData: {
              wecom: {
                  corpid: params.corpid,
                  agentid: params.agentid,
                  msgId
              }
          }
      };

      await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg: config,
        dispatcherOptions: {
          responsePrefix: runtime.channel.reply.resolveEffectiveMessagesConfig(config, agentId)
            .responsePrefix,
          deliver: async (payload: ReplyPayload) => {
            const text = payload.text || "";
            if (!text) return;
            console.log(`[WeCom] deliver() called for ${fromUser}, text len=${text.length}`);
            try {
              await client.sendText(fromUser, text);
            } catch (err) {
              console.error(`[WeCom] CRITICAL: Failed to send reply to ${fromUser}: ${String(err)}`);
            }
          },
          onError: (err: any) => {
            console.error(`[WeCom] Dispatch error: ${err}`);
          },
        },
        replyOptions: {
          disableBlockStreaming:
            typeof params.blockStreaming === "boolean" ? !params.blockStreaming : undefined,
        },
      });

    } catch (err) {
      console.error("[WeCom] Message processing error:", err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end("Internal error");
      }
    }
    return;
  }

  res.statusCode = 405;
  res.end("Method not allowed");
}
