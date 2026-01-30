# Moltbot (中文指南)

Moltbot 是一个强大的多模态 AI 机器人网关，支持 WhatsApp, Telegram, 企业微信 (WeCom) 等多种即时通讯渠道，并可接入各类 LLM 模型（如 GPT-4, Claude 3, DeepSeek 等）。

> [English README](README.md)

---

## 🚀 快速开始：使用发布包运行 (推荐)

### 📋 1. 环境准备

在开始之前，请确保您的运行环境满足以下要求：

- **操作系统**: Linux, macOS 或 Windows
- **Node.js**: 版本 22 或更高 (推荐使用 `nvm` 安装管理)

### 📥 2. 下载与安装

1.  **下载发布包**:
    前往 [GitHub Releases](https://github.com/moltbot/moltbot/releases) 页面，下载最新版本的发布包 (通常命名为 `moltbot-release.zip`)。

2.  **解压文件**:
    将下载的压缩包解压到您希望运行的目录。

3.  **安装依赖**:
    进入解压后的目录，运行以下命令安装必要的运行依赖：
    ```bash
    npm install --omit=dev
    ```

---

## ⚙️ 配置指南

在运行之前，我们需要配置 AI 模型服务商 (SiliconFlow)、通讯渠道 (企业微信) 以及工具 (网络搜索)。

**推荐方式：使用 .env 配置文件**

1.  **创建配置文件**:
    在解压后的目录中，将 `.env.example` 复制为 `.env`:
    ```bash
    cp .env.example .env
    ```
    *(Windows 用户可以直接复制文件并重命名)*

2.  **修改配置**:
    使用文本编辑器打开 `.env` 文件，填入您的配置信息。
    
    该文件已包含所有常用配置项，您只需要填入相应的 API Key 和参数即可。修改保存后，下次启动即可生效。

### 📝 主要配置项说明

打开 `.env` 文件，您会看到以下配置项：

#### 🤖 1. SiliconFlow (硅基流动)
配置模型服务商 API Key 及默认模型。
```properties
SILICONFLOW_API_KEY="sk-xxxxxxxx"
MOLTBOT_AGENTS_DEFAULTS_PRIMARY_MODEL="deepseek-ai/DeepSeek-V3.2"
```

#### 💬 2. 企业微信 (WeCom)
配置企业微信参数。
```properties
# 填入企业微信后台获取的信息
WECOM_CORPID="ww-your-corp-id"
WECOM_CORPSECRET="your-app-secret"
WECOM_AGENTID="1000001"
# 接收消息所需 (Webhook)
WECOM_TOKEN="your-webhook-token"
WECOM_AESKEY="your-encoding-aes-key"
```

#### 🔍 3. 网络搜索 (Web Search)
Moltbot 支持 Tavily, Brave 和 Perplexity 等搜索服务。
```properties
# 选择搜索提供商: tavily, brave, 或 perplexity
WEB_SEARCH_PROVIDER="tavily"
TAVILY_API_KEY="tvly-xxxx"
```

#### 🚪 4. 网关访问 Token
设置访问 Web 管理后台的密码。
```properties
CLAWDBOT_GATEWAY_TOKEN="my-secret-token"
```

---

## ▶️ 启动运行

完成配置后，即可启动 Moltbot 网关服务。

### 🔍 步骤 1: 验证配置（推荐）

在启动前，建议运行配置检查脚本验证您的配置是否正确：

```bash
# 赋予脚本执行权限
chmod +x check-config.sh

# 运行配置检查
./check-config.sh
```

该脚本会检查：
- ✅ 必要的配置项是否已设置
- ✅ API Key 是否正确填写
- ✅ 企业微信、网络搜索等可选功能的配置状态

如果检查通过，将显示访问地址和启动命令。

### 🚀 步骤 2: 启动服务

我们提供了一个便捷的启动脚本 `start.sh`，它会自动检查依赖并启动服务。

```bash
# 赋予脚本执行权限 (仅第一次需要)
chmod +x start.sh

# 启动网关服务 (默认)
./start.sh
```

启动成功后，您会看到：
```
🚀 Starting Moltbot Gateway...
📍 Dashboard: http://localhost:18789/
```

您也可以通过该脚本执行其他命令，例如查看版本或帮助：
```bash
./start.sh --version
./start.sh --help
```

### 停止服务
如需停止服务，请在终端中按 `Ctrl+C`。

---

## ❓ 常见问题
1.  终端会显示运行日志。
2.  您可以访问 Web 管理后台: `http://localhost:18789/?token=my-secret-token` (端口默认为 18789)。

### 常用命令

- **查看当前配置**:
  ```bash
  node moltbot.mjs config get
  ```

- **检查服务状态**:
  ```bash
  node moltbot.mjs channels status
  ```

---

## 🛠️ 常见问题

**Q: 如何切换其他模型？**
A: 在 `.env` 文件中修改 `MOLTBOT_AGENTS_DEFAULTS_PRIMARY_MODEL` 变量。例如切换到 GLM-4：
```properties
MOLTBOT_AGENTS_DEFAULTS_PRIMARY_MODEL="Pro/zai-org/GLM-4.7"
```

**Q: 企业微信如何接收消息？**
A: 您的服务器需要有公网 IP 或配置内网穿透。在企业微信后台设置 "接收消息服务器 URL" 为 `http://<您的IP>:18789/wecom/webhook`，并在 `.env` 中配置 Token 和 EncodingAESKey。

**Q: 如何启用 Brave 搜索？**
A: 在 `.env` 中设置 `WEB_SEARCH_PROVIDER="brave"` 并填入 `BRAVE_API_KEY`。

**Q: UI 无法访问？**
A: 检查以下几点：
1. 确认 `.env` 文件中设置了 `GATEWAY_MODE="local"`
2. 确认设置了 `CLAWDBOT_GATEWAY_TOKEN`
3. 访问 `http://localhost:18789/?token=您的token值`
4. 检查防火墙是否阻止了 18789 端口
5. 查看终端日志是否有错误信息

---

## ✅ 配置验证

启动成功后，可以运行以下命令验证配置：

### 1. 检查服务状态
```bash
node moltbot.mjs channels status
```

### 2. 验证 SiliconFlow 配置
```bash
node moltbot.mjs config get models.providers.siliconflow
```

### 3. 验证企业微信配置
```bash
node moltbot.mjs channels list
```
应该能看到 `wecom:env` 账户。

### 4. 测试 AI 对话
```bash
node moltbot.mjs agent --message "你好，测试一下"
```

---

## 🔧 故障排除

### 问题：启动失败，提示缺少依赖
**解决方案**：删除 `node_modules` 目录，重新运行 `./start.sh`

### 问题：企业微信收不到消息
**检查清单**：
1. 在企业微信后台验证 Webhook URL 配置是否正确
2. 检查 `.env` 中的 `WECOM_TOKEN` 和 `WECOM_AESKEY` 是否与后台一致
3. 确认服务器防火墙已开放 18789 端口
4. 查看终端日志，确认企业微信 Webhook 已注册成功

### 问题：AI 回复错误或不工作
**检查清单**：
1. 验证 `SILICONFLOW_API_KEY` 是否正确
2. 检查 API Key 是否有足够的配额
3. 查看终端日志中的错误信息
4. 尝试切换到其他模型

---

## 📚 进阶配置

### 自定义 OpenAI 兼容服务商

如果您想使用其他 OpenAI 兼容的服务商，可以在 `.env` 中添加：

```properties
# 自定义 OpenAI 兼容服务商
OPENAI_API_KEY="your-api-key"
OPENAI_BASE_URL="https://your-custom-endpoint.com/v1"
MOLTBOT_AGENTS_DEFAULTS_PRIMARY_MODEL="your-model-name"
```

### 修改网关端口和绑定地址

```properties
# 修改端口（默认 18789）
GATEWAY_PORT="8080"

# 绑定到所有网络接口（允许外部访问）
GATEWAY_BIND="lan"  # 选项: loopback, lan, auto
```

⚠️ **安全提示**：如果设置 `GATEWAY_BIND="lan"`，请务必设置强密码的 `CLAWDBOT_GATEWAY_TOKEN`。

---

## 📖 更多文档

- [官方文档](https://docs.molt.bot)
- [GitHub 仓库](https://github.com/moltbot/moltbot)
- [问题反馈](https://github.com/moltbot/moltbot/issues)
