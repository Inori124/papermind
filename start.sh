#!/bin/bash

# === PaperMind 启动脚本 ===

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/tmp/papermind.log"

cd "$PROJECT_DIR"

# 检查是否已经在运行（避免重复启动）
if lsof -i :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "$(date): PaperMind 已在运行（端口 3000）" >> "$LOG_FILE"
  exit 0
fi

echo "$(date): 正在启动 PaperMind..." >> "$LOG_FILE"

# 确保 node 可用（Homebrew 和 nvm 两种情况都处理）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:$PATH"

# 如果还没构建过，先构建
if [ ! -d "$PROJECT_DIR/.next" ]; then
  echo "$(date): 首次运行，正在构建..." >> "$LOG_FILE"
  npm run build >> "$LOG_FILE" 2>&1
  if [ $? -ne 0 ]; then
    echo "$(date): 构建失败，请检查日志" >> "$LOG_FILE"
    exit 1
  fi
fi

# 用生产模式启动
exec npm start >> "$LOG_FILE" 2>&1
