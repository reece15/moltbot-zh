# Moltbot (中文指南)

Moltbot 是一个强大的多模态 AI 机器人网关，支持 WhatsApp, Telegram, 企业微信 (WeCom) 等多种即时通讯渠道，并可接入各类 LLM 模型（如 GPT-4, Claude 3, DeepSeek 等）。

> [English README](README.md)

---

## 🚀 快速开始：SiliconFlow + 企业微信 (WeCom)

本指南专注于帮助您快速配置并运行 Moltbot，使用 **SiliconFlow (硅基流动)** 作为模型服务商，并接入 **企业微信** 进行交互。

### 📋 1. 准备工作

在开始之前，请确保您已获取以下信息：

1.  **SiliconFlow API Key**:
    -   注册并登录 [SiliconFlow](https://siliconflow.cn/)。
    -   创建 API Key (通常以 `sk-` 开头)。
    -   支持模型：`deepseek-ai/DeepSeek-V3.2` (默认), `Pro/zai-org/GLM-4.7`, `Pro/MiniMaxAI/MiniMax-M2.1`, `moonshotai/Kimi-K2-Thinking` 等。

2.  **企业微信 (WeCom) 配置**:
    -   登录 [企业微信管理后台](https://work.weixin.qq.com/)。
    -   **CorpID (企业ID)**: 在 "我的企业" -> "企业信息" 中查看。
    -   **创建应用**: 在 "应用管理" 中创建一个新应用（如 "AI助手"）。
    -   **AgentID & Secret**: 在应用详情页查看。

---

### 🐳 2. 方式一：Docker 运行 (安全/生产环境)

使用 Docker 运行是最简单且安全的方式。您可以通过环境变量直接配置参数，无需修改任何文件。

#### 第一步：构建镜像

由于企业微信插件是最新添加的功能，建议先在本地构建包含插件的 Docker 镜像：

```bash
# 确保您在项目根目录下
docker build -t moltbot-local .
```

#### 第二步：启动容器

使用以下命令启动 Moltbot。请替换 `<您的...>` 为实际值。

```bash
docker run -d --name moltbot \
  --restart unless-stopped \
  -p 18789:18789 \
  -e SILICONFLOW_API_KEY="sk-您的SiliconFlow密钥" \
  -e WECOM_CORPID="ww您的企业ID" \
  -e WECOM_CORPSECRET="您的应用Secret" \
  -e WECOM_AGENTID="1000001" \
  moltbot-local
```

> **注意**: 
> - 启动后，Moltbot 会自动使用 SiliconFlow 的 DeepSeek V3.2 模型。
> - 企业微信配置将作为默认账号 ("env") 加载。
> - 您可以通过 `docker logs -f moltbot` 查看运行日志。

#### 第三步：验证

您可以尝试通过 HTTP API 发送测试消息，或者如果配置了企业微信回调（需要公网 IP），直接在企业微信中与机器人对话。

---

### 💻 3. 方式二：源码运行 (开发/调试)

如果您需要进行二次开发或本地调试，可以使用源码运行。

#### 环境要求
- Node.js 22+ (推荐使用 `nvm` 管理)
- pnpm (通过 `npm install -g pnpm` 安装)

#### 运行步骤

1.  **安装依赖**:
    ```bash
    pnpm install
    ```

2.  **配置 SiliconFlow**:
    ```bash
    # 设置 API Key
    export SILICONFLOW_API_KEY="sk-您的SiliconFlow密钥"
    
    # (可选) 设置默认模型，默认为 DeepSeek V3.2
    # export MOLTBOT_AGENTS_DEFAULTS_PRIMARY_MODEL="deepseek-ai/DeepSeek-V3.2"
    ```

3.  **配置企业微信**:
    您可以使用命令行进行持久化配置：
    ```bash
    # 启用并配置企业微信
    pnpm dev config set gateway.mode local
    pnpm dev config set gateway.auth.token "moltbot-secret"
    pnpm dev config set channels.wecom.mycorp.corpid "ww您的企业ID"
    pnpm dev config set channels.wecom.mycorp.corpsecret "您的应用Secret"
    pnpm dev config set channels.wecom.mycorp.agentid "1000001"
    pnpm dev config set channels.wecom.mycorp.enabled true
    ```

3.  **配置 SiliconFlow**:
    创建或编辑 `.env` 文件，添加您的 API Key：
    ```bash
    echo "SILICONFLOW_API_KEY=sk-your-api-key-here" >> .env
    ```

4.  **构建前端 (可选)**:
    如果您需要使用网页看板 (Web Dashboard)，请先构建前端资源：
    ```bash
    pnpm ui:build
    ```

5.  **启动服务**:
    ```bash
    pnpm dev gateway
    ```
    
    启动后，您可以访问网页看板 (需要 Token):
    - URL: `http://localhost:18789/?token=moltbot-secret`
    
    *(注意：如果在配置中设置了不同的 `gateway.auth.token`，请替换 URL 中的 `moltbot-secret`)*

服务启动后，您将在终端看到二维码（用于 WhatsApp，可忽略）以及服务运行状态。

---

## 🛠️ 高级配置

### 切换模型

如果您想使用 SiliconFlow 的其他模型（如 GLM-4.7），可以通过环境变量或配置文件修改：

- **Docker**: 添加 `-e MOLTBOT_AGENTS_DEFAULTS_PRIMARY_MODEL="Pro/zai-org/GLM-4.7"`
- **CLI**: `pnpm dev config set agents.defaults.primaryModel "Pro/zai-org/GLM-4.7"`

### 企业微信回调配置 (接收消息)

要让机器人能够接收并回复企业微信消息，您需要：
1.  确保 Moltbot 服务器拥有公网 IP 或使用内网穿透。
2.  在企业微信应用设置中配置 "接收消息服务器 URL"。
3.  URL 格式: `http://<您的IP>:18789/wecom/webhook` (需确认实际路由)。
4.  在 Docker 或 Config 中配置 `Token` 和 `EncodingAESKey`。

```bash
-e WECOM_TOKEN="您的Token" \
-e WECOM_AESKEY="您的EncodingAESKey"
```

*(注：当前版本 WeCom 插件主要支持主动发送消息，接收消息功能正在完善中)*
