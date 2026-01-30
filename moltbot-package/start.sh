#!/bin/bash
set -e

# Ensure we are in the script directory
cd "$(dirname "$0")"

# Function to check command existence
exists() { command -v "$1" >/dev/null 2>&1; }

# Check for node
if ! exists node; then
  echo "Error: node is not installed or not in PATH."
  exit 1
fi

# Check and create .env file if missing
if [ ! -f ".env" ]; then
  echo "⚠️  Warning: .env file not found!"
  if [ -f ".env.example" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please edit .env to configure your settings."
    echo ""
    echo "Required configurations:"
    echo "  1. SILICONFLOW_API_KEY - Get from https://siliconflow.cn/"
    echo "  2. CLAWDBOT_GATEWAY_TOKEN - Set a secure password"
    echo "  3. WECOM_CORP_ID, WECOM_SECRET, WECOM_AGENT_ID (optional)"
    echo ""
    echo "After editing .env, run ./start.sh again."
    exit 1
  else
    echo "❌ Error: .env.example not found. Cannot create .env file."
    exit 1
  fi
fi

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "First run detected. Installing dependencies..."
  if exists pnpm; then
    echo "Using pnpm for installation..."
    pnpm install --prod --no-frozen-lockfile --registry=https://registry.npmmirror.com
  else
    echo "Using npm with npmmirror registry..."
    npm install --omit=dev --no-audit --no-fund --registry=https://registry.npmmirror.com
  fi
fi

# Default to starting gateway if no args provided
if [ $# -eq 0 ]; then
  echo "🚀 Starting Moltbot Gateway..."
  echo "📍 Dashboard: http://localhost:18789/"
  echo ""
  exec node moltbot.mjs gateway
else
  exec node moltbot.mjs "$@"
fi
