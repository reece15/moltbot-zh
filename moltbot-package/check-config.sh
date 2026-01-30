#!/bin/bash
# Moltbot 配置检查脚本

set -e
cd "$(dirname "$0")"

echo "======================================"
echo "   Moltbot 配置检查"
echo "======================================"
echo ""

# 检查 .env 文件
if [ ! -f ".env" ]; then
  echo "❌ 错误: .env 文件不存在"
  echo "   请运行: cp .env.example .env"
  echo "   然后编辑 .env 文件填入您的配置"
  exit 1
fi

echo "✅ .env 文件存在"
echo ""

# 加载 .env 文件
export $(grep -v '^#' .env | xargs)

# 检查必要配置
errors=0

echo "检查必要配置项："
echo "-----------------------------------"

# 检查 GATEWAY_MODE
if [ -z "$GATEWAY_MODE" ]; then
  echo "❌ GATEWAY_MODE 未设置"
  errors=$((errors + 1))
else
  echo "✅ GATEWAY_MODE: $GATEWAY_MODE"
fi

# 检查 CLAWDBOT_GATEWAY_TOKEN
if [ -z "$CLAWDBOT_GATEWAY_TOKEN" ] || [ "$CLAWDBOT_GATEWAY_TOKEN" = "my-secret-token" ]; then
  echo "⚠️  CLAWDBOT_GATEWAY_TOKEN 未设置或使用默认值（建议修改）"
  errors=$((errors + 1))
else
  echo "✅ CLAWDBOT_GATEWAY_TOKEN: 已设置"
fi

# 检查 SILICONFLOW_API_KEY
if [ -z "$SILICONFLOW_API_KEY" ] || [ "$SILICONFLOW_API_KEY" = "sk-xxxx" ]; then
  echo "❌ SILICONFLOW_API_KEY 未设置或使用示例值"
  errors=$((errors + 1))
else
  echo "✅ SILICONFLOW_API_KEY: 已设置"
fi

echo ""
echo "检查可选配置项："
echo "-----------------------------------"

# 检查企业微信配置
if [ -n "$WECOM_CORP_ID" ] && [ -n "$WECOM_SECRET" ] && [ -n "$WECOM_AGENT_ID" ]; then
  echo "✅ 企业微信 (WeCom): 已配置"
  if [ -n "$WECOM_TOKEN" ] && [ -n "$WECOM_ENCODING_AES_KEY" ]; then
    echo "   ✅ Webhook 配置: 已配置 (可接收消息)"
  else
    echo "   ⚠️  Webhook 配置: 未配置 (仅可发送消息)"
  fi
else
  echo "⚠️  企业微信 (WeCom): 未配置"
fi

# 检查网络搜索配置
if [ -n "$WEB_SEARCH_PROVIDER" ]; then
  echo "✅ 网络搜索: $WEB_SEARCH_PROVIDER"
  case "$WEB_SEARCH_PROVIDER" in
    tavily)
      if [ -z "$TAVILY_API_KEY" ] || [ "$TAVILY_API_KEY" = "tvly-xxxx" ]; then
        echo "   ❌ TAVILY_API_KEY 未正确配置"
        errors=$((errors + 1))
      else
        echo "   ✅ TAVILY_API_KEY 已配置"
      fi
      ;;
    brave)
      if [ -z "$BRAVE_API_KEY" ]; then
        echo "   ❌ BRAVE_API_KEY 未配置"
        errors=$((errors + 1))
      else
        echo "   ✅ BRAVE_API_KEY 已配置"
      fi
      ;;
    perplexity)
      if [ -z "$PERPLEXITY_API_KEY" ]; then
        echo "   ❌ PERPLEXITY_API_KEY 未配置"
        errors=$((errors + 1))
      else
        echo "   ✅ PERPLEXITY_API_KEY 已配置"
      fi
      ;;
  esac
else
  echo "⚠️  网络搜索: 未配置"
fi

echo ""
echo "======================================"

if [ $errors -eq 0 ]; then
  echo "🎉 配置检查通过！"
  echo ""
  echo "现在可以运行 ./start.sh 启动服务"
  echo "访问地址: http://localhost:${GATEWAY_PORT:-18789}/?token=$CLAWDBOT_GATEWAY_TOKEN"
  exit 0
else
  echo "❌ 发现 $errors 个配置问题"
  echo ""
  echo "请编辑 .env 文件修复上述问题，然后重新运行此脚本"
  exit 1
fi
