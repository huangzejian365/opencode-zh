#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           OpenCode 中文版 一键安装脚本                        ║"
echo "║           OpenCode Chinese Version Installer                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

INSTALL_DIR="${INSTALL_DIR:-$HOME/.opencode-zh}"
OPENCODE_VERSION="${OPENCODE_VERSION:-latest}"
BRANCH="${BRANCH:-main}"

echo -e "${BLUE}安装目录: ${INSTALL_DIR}${NC}"
echo -e "${BLUE}版本: ${OPENCODE_VERSION}${NC}"
echo ""

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}错误: 未找到 $1，请先安装 $1${NC}"
        echo -e "${YELLOW}安装建议:${NC}"
        case "$1" in
            "node")
                echo "  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash -"
                echo "  sudo apt-get install -y nodejs"
                ;;
            "bun")
                echo "  npm install -g bun"
                ;;
            "git")
                echo "  sudo apt-get install -y git"
                ;;
        esac
        exit 1
    fi
}

echo -e "${CYAN}[1/6] 检查系统环境...${NC}"
check_command "node"
check_command "git"

if ! command -v bun &> /dev/null; then
    echo -e "${YELLOW}未找到 Bun，正在安装...${NC}"
    npm install -g bun
fi

NODE_VERSION=$(node --version)
BUN_VERSION=$(bun --version)
echo -e "${GREEN}✓ Node.js: ${NODE_VERSION}${NC}"
echo -e "${GREEN}✓ Bun: ${BUN_VERSION}${NC}"
echo ""

echo -e "${CYAN}[2/6] 克隆 OpenCode 源码...${NC}"
if [ -d "$INSTALL_DIR/opencode" ]; then
    echo -e "${YELLOW}目录已存在，正在更新...${NC}"
    cd "$INSTALL_DIR/opencode"
    git fetch origin
    git checkout "$BRANCH"
    git reset --hard "origin/$BRANCH"
else
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    git clone --depth 1 --branch "$BRANCH" https://github.com/anomalyco/opencode.git
    cd opencode
fi
echo -e "${GREEN}✓ 源码克隆完成${NC}"
echo ""

echo -e "${CYAN}[3/6] 安装依赖...${NC}"
bun install
echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

echo -e "${CYAN}[4/6] 应用中文汉化...${NC}"
TRANSLATIONS_FILE="$INSTALL_DIR/opencode/opencode-zh/translations/zh-CN.json"
LOCALIZE_SCRIPT="$INSTALL_DIR/opencode/opencode-zh/localize.ts"

if [ ! -f "$TRANSLATIONS_FILE" ]; then
    echo -e "${YELLOW}下载汉化文件...${NC}"
    mkdir -p "$INSTALL_DIR/opencode/opencode-zh/translations"
    mkdir -p "$INSTALL_DIR/opencode/opencode-zh/bin"
    
    curl -fsSL "https://raw.githubusercontent.com/opencode-zh/opencode-zh/main/translations/zh-CN.json" \
        -o "$TRANSLATIONS_FILE" 2>/dev/null || {
        echo -e "${YELLOW}无法下载翻译文件，使用内置版本${NC}"
    }
fi

if [ -f "$LOCALIZE_SCRIPT" ]; then
    bun run "$LOCALIZE_SCRIPT"
    echo -e "${GREEN}✓ 汉化应用完成${NC}"
else
    echo -e "${YELLOW}⚠ 汉化脚本不存在，跳过汉化${NC}"
fi
echo ""

echo -e "${CYAN}[5/6] 构建 OpenCode...${NC}"
cd packages/opencode
bun run build
echo -e "${GREEN}✓ 构建完成${NC}"
echo ""

echo -e "${CYAN}[6/6] 配置启动命令...${NC}"

BINARY_PATH="$INSTALL_DIR/opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode"

if [ -f "$BINARY_PATH" ]; then
    # 方法1: 安装到 /usr/local/bin (需要 sudo，最可靠)
    if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
        ln -sf "$BINARY_PATH" /usr/local/bin/opencode-zh 2>/dev/null || true
        if [ -f /usr/local/bin/opencode-zh ]; then
            echo -e "${GREEN}✓ 启动命令已创建: opencode-zh (系统级)${NC}"
        fi
    fi
    
    # 方法2: 安装到 ~/.local/bin (用户级，备选)
    if [ ! -f /usr/local/bin/opencode-zh ]; then
        BIN_DIR="$HOME/.local/bin"
        mkdir -p "$BIN_DIR"
        ln -sf "$BINARY_PATH" "$BIN_DIR/opencode-zh"
        
        if ! echo "$PATH" | grep -q "$BIN_DIR"; then
            echo "" >> ~/.bashrc
            echo "# OpenCode 中文版" >> ~/.bashrc
            echo "export PATH=\"\$PATH:$BIN_DIR\"" >> ~/.bashrc
            echo -e "${YELLOW}已添加 $BIN_DIR 到 PATH${NC}"
            echo -e "${YELLOW}请运行 'source ~/.bashrc' 或重新打开终端${NC}"
        fi
        echo -e "${GREEN}✓ 启动命令已创建: opencode-zh (用户级)${NC}"
    fi
    
    # 方法3: 创建别名作为后备
    if ! grep -q "alias opencode-zh=" ~/.bashrc 2>/dev/null; then
        echo "alias opencode-zh='$BINARY_PATH'" >> ~/.bashrc
    fi
else
    echo -e "${RED}✗ 二进制文件不存在: $BINARY_PATH${NC}"
    exit 1
fi
echo ""

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    安装完成！                                ║"
echo "║                  Installation Complete!                      ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  启动方式:                                                   ║"
echo "║    source ~/.bashrc                                          ║"
echo "║    opencode-zh                                               ║"
echo "║                                                              ║"
echo "║  或直接运行:                                                 ║"
echo "║    $BINARY_PATH                                              ║"
echo "║                                                              ║"
echo "║  更新方式:                                                   ║"
echo "║    curl -fsSL https://install.opencode-zh.cn | bash         ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
