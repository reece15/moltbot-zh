#!/bin/bash
set -e

echo "Cleaning up..."
rm -rf moltbot-package moltbot-release.zip

echo "Building..."
pnpm build

echo "Packaging..."
mkdir -p moltbot-package
cp -r dist moltbot-package/
cp moltbot.mjs moltbot-package/
cp .env.example moltbot-package/
cp package.json moltbot-package/
cp pnpm-lock.yaml moltbot-package/
cp pnpm-workspace.yaml moltbot-package/
cp README-zh.md moltbot-package/
cp LICENSE moltbot-package/
cp -r scripts moltbot-package/
cp -r docs moltbot-package/
rsync -av --exclude='node_modules' extensions moltbot-package/

# Create .npmrc
echo 'auto-install-peers=false' > moltbot-package/.npmrc
echo 'strict-peer-dependencies=false' >> moltbot-package/.npmrc
echo 'public-hoist-pattern[]=*typescript*' >> moltbot-package/.npmrc

# Create start.sh with improved logic
START_SCRIPT="moltbot-package/start.sh"
echo '#!/bin/bash' > "$START_SCRIPT"
echo 'set -e' >> "$START_SCRIPT"
echo '' >> "$START_SCRIPT"
echo '# Ensure we are in the script directory' >> "$START_SCRIPT"
echo 'cd "$(dirname "$0")"' >> "$START_SCRIPT"
echo 'SCRIPT_DIR="$(pwd)"' >> "$START_SCRIPT"
echo '' >> "$START_SCRIPT"
echo '# Set bundled plugins directory explicitly' >> "$START_SCRIPT"
echo 'export CLAWDBOT_BUNDLED_PLUGINS_DIR="$SCRIPT_DIR/extensions"' >> "$START_SCRIPT"
echo '' >> "$START_SCRIPT"
echo '# Function to check command existence' >> "$START_SCRIPT"
echo 'exists() { command -v "$1" >/dev/null 2>&1; }' >> "$START_SCRIPT"
echo '' >> "$START_SCRIPT"
echo '# Check for node' >> "$START_SCRIPT"
echo 'if ! exists node; then' >> "$START_SCRIPT"
echo '  echo "Error: node is not installed or not in PATH."' >> "$START_SCRIPT"
echo '  exit 1' >> "$START_SCRIPT"
echo 'fi' >> "$START_SCRIPT"
echo '' >> "$START_SCRIPT"
echo '# Install dependencies if node_modules is missing' >> "$START_SCRIPT"
echo 'if [ ! -d "node_modules" ]; then' >> "$START_SCRIPT"
echo '  echo "First run detected. Installing dependencies..."' >> "$START_SCRIPT"
echo '  if exists pnpm; then' >> "$START_SCRIPT"
echo '    echo "Using pnpm for installation..."' >> "$START_SCRIPT"
echo '    pnpm install --prod --no-frozen-lockfile --registry=https://registry.npmmirror.com' >> "$START_SCRIPT"
echo '  else' >> "$START_SCRIPT"
echo '    echo "Using npm with npmmirror registry..."' >> "$START_SCRIPT"
echo '    npm install --omit=dev --no-audit --no-fund --registry=https://registry.npmmirror.com' >> "$START_SCRIPT"
echo '  fi' >> "$START_SCRIPT"
echo 'fi' >> "$START_SCRIPT"
echo '' >> "$START_SCRIPT"
echo '# Ensure .env exists' >> "$START_SCRIPT"
echo 'if [ ! -f ".env" ]; then' >> "$START_SCRIPT"
echo '  if [ -f ".env.example" ]; then' >> "$START_SCRIPT"
echo '    echo "Creating .env from .env.example..."' >> "$START_SCRIPT"
echo '    cp .env.example .env' >> "$START_SCRIPT"
echo '    echo "Note: .env created. Please edit it to add your API keys."' >> "$START_SCRIPT"
echo '  else' >> "$START_SCRIPT"
echo '    echo "Warning: .env.example not found. Creating empty .env with GATEWAY_MODE=local..."' >> "$START_SCRIPT"
echo '    echo "GATEWAY_MODE=local" > .env' >> "$START_SCRIPT"
echo '    echo "# GATEWAY_PORT=18789" >> .env' >> "$START_SCRIPT"
echo '    echo "# GATEWAY_BIND=loopback" >> .env' >> "$START_SCRIPT"
echo '  fi' >> "$START_SCRIPT"
echo 'fi' >> "$START_SCRIPT"
echo '' >> "$START_SCRIPT"
echo '# Default to starting gateway if no args provided' >> "$START_SCRIPT"
echo 'if [ $# -eq 0 ]; then' >> "$START_SCRIPT"
echo '  echo "Starting Moltbot Gateway..."' >> "$START_SCRIPT"
echo '  exec node moltbot.mjs gateway' >> "$START_SCRIPT"
echo 'else' >> "$START_SCRIPT"
echo '  exec node moltbot.mjs "$@"' >> "$START_SCRIPT"
echo 'fi' >> "$START_SCRIPT"

chmod +x "$START_SCRIPT"

echo "Verifying package content..."
ls -F moltbot-package/
