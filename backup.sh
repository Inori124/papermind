#!/bin/bash

# === PaperMind 自动备份脚本 ===

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 备份到 iCloud（如果存在），否则备份到 Home 目录
ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
if [ -d "$ICLOUD_DIR" ]; then
  BACKUP_DIR="$ICLOUD_DIR/PaperMind-Backups"
else
  BACKUP_DIR="$HOME/PaperMind-Backups"
fi

DATE=$(date +%Y%m%d_%H%M%S)
TARGET="$BACKUP_DIR/backup_$DATE"

mkdir -p "$TARGET"

# 备份数据库
if [ -f "$PROJECT_DIR/data/papermind.db" ]; then
  cp "$PROJECT_DIR/data/papermind.db" "$TARGET/"
  echo "✓ 数据库已备份"
else
  echo "✗ 数据库不存在，跳过"
fi

# 备份 PDF 文件
if [ -d "$PROJECT_DIR/uploads" ] && [ "$(ls -A $PROJECT_DIR/uploads 2>/dev/null)" ]; then
  cp -r "$PROJECT_DIR/uploads" "$TARGET/"
  echo "✓ PDF 文件已备份"
else
  echo "✗ 无 PDF 文件，跳过"
fi

# 备份环境变量
if [ -f "$PROJECT_DIR/.env.local" ]; then
  cp "$PROJECT_DIR/.env.local" "$TARGET/"
  echo "✓ 环境配置已备份"
fi

# 清理 30 天前的旧备份
find "$BACKUP_DIR" -name "backup_*" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null

echo ""
echo "备份完成 → $TARGET"
echo "大小：$(du -sh "$TARGET" | cut -f1)"
