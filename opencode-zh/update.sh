#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-$HOME/.opencode-zh}"

echo -e "${CYAN}OpenCode 中文版 更新脚本${NC}"
echo ""

if [ ! -d "$INSTALL_DIR/opencode" ]; then
    echo -e "${RED}未找到安装目录，请先运行安装脚本${NC}"
    exit 1
fi

cd "$INSTALL_DIR/opencode"

echo -e "${CYAN}[1/4] 拉取最新代码...${NC}"
git fetch origin
git reset --hard origin/main
echo -e "${GREEN}✓ 完成${NC}"

echo -e "${CYAN}[2/4] 更新依赖...${NC}"
bun install
echo -e "${GREEN}✓ 完成${NC}"

echo -e "${CYAN}[3/4] 应用汉化...${NC}"
if [ -f "opencode-zh/localize.ts" ]; then
    bun run opencode-zh/localize.ts
fi
echo -e "${GREEN}✓ 完成${NC}"

echo -e "${CYAN}[4/4] 重新构建...${NC}"
cd packages/opencode
bun run build
echo -e "${GREEN}✓ 完成${NC}"

echo ""
echo -e "${GREEN}更新完成！运行 'opencode-zh' 启动${NC}"
