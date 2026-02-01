export class WeComClient {
  private corpid: string;
  private corpsecret: string;
  private agentid: string;
  private accessToken: string = "";
  private tokenExpiresAt: number = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(corpid: string, corpsecret: string, agentid: string) {
    this.corpid = corpid;
    this.corpsecret = corpsecret;
    this.agentid = agentid;
  }

  updateSecret(corpsecret: string) {
    if (this.corpsecret !== corpsecret) {
      this.corpsecret = corpsecret;
      this.accessToken = ""; // Reset token as secret changed
      this.tokenExpiresAt = 0;
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpid}&corpsecret=${this.corpsecret}`;
    const resp = await fetch(url);
    const data = await resp.json() as any;

    if (data.errcode !== 0) {
      throw new Error(`Failed to get access token: ${data.errmsg}`);
    }

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 200) * 1000; // buffer
    return this.accessToken;
  }

  async sendText(toUser: string, content: string): Promise<void> {
    const task = async () => {
      console.log(`[WeCom] Processing sendText for ${toUser}: ${content.slice(0, 20)}...`);
      try {
        await this.doSendText(toUser, content);
        console.log(`[WeCom] Successfully sent to ${toUser}`);
      } catch (err) {
        console.error(`[WeCom] Failed to send to ${toUser}:`, err);
        throw err;
      }
    };

    // Ensure we run regardless of previous task status
    const next = this.queue.then(task, task);
    
    // Update queue but keep it chainable (catch errors so they don't crash the loop, 
    // though .then(task, task) actually propagates the new error which is fine 
    // as long as the next iteration handles rejection via .then(..., ...))
    this.queue = next;

    return next;
  }

  private async doSendText(toUser: string, content: string): Promise<void> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
    
    const payload = {
      touser: toUser,
      msgtype: "text",
      agentid: this.agentid,
      text: {
        content: content
      }
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await resp.json() as any;
    if (data.errcode !== 0) {
      throw new Error(`Failed to send message: ${data.errmsg}`);
    }
  }
}

const clients = new Map<string, WeComClient>();

export function getWeComClient(corpid: string, corpsecret: string, agentid: string): WeComClient {
  const key = `${corpid}:${agentid}`;
  let client = clients.get(key);
  
  if (!client) {
    client = new WeComClient(corpid, corpsecret, agentid);
    clients.set(key, client);
  } else {
    client.updateSecret(corpsecret);
  }
  
  return client;
}
