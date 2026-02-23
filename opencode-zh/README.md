# OpenCode 中文版

OpenCode 的中文本地化版本，提供完整的中文界面支持。

## 安装方式

### 方式一：NPM 安装（推荐）

```bash
npm install -g opencode-zh
```

安装完成后运行：
```bash
source ~/.bashrc
opencode-zh
```

### 方式二：一键脚本安装

```bash
curl -fsSL https://raw.githubusercontent.com/opencode-zh/opencode-zh/main/install.sh | bash
```

### 方式三：Bun 安装

```bash
bun install -g opencode-zh
```

### 方式四：手动安装

```bash
# 1. 克隆仓库
git clone https://github.com/opencode-zh/opencode-zh.git
cd opencode-zh

# 2. 安装
npm install -g .
# 或
bun install -g .
```

## 前置要求

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Bun](https://bun.sh/)（安装脚本会自动安装）
- [Git](https://git-scm.com/)

## 使用方法

### 快捷启动

```bash
opencode-zh
```

### 在项目目录中启动

```bash
cd /path/to/your/project
opencode-zh
```

### 查看帮助

```bash
opencode-zh --help
```

## 更新

### NPM 方式

```bash
npm update -g opencode-zh
```

### 脚本方式

```bash
curl -fsSL https://raw.githubusercontent.com/opencode-zh/opencode-zh/main/update.sh | bash
```

### 手动更新

```bash
cd ~/.opencode-zh/opencode
git pull
bun install
bun run opencode-zh/localize.ts
cd packages/opencode && bun run build
```

## 安装方式对比

| 方式 | 优点 | 缺点 |
|------|------|------|
| **NPM** | 最简单，自动更新 | 需要 Node.js |
| **脚本** | 自动安装依赖 | 需要网络 |
| **手动** | 完全控制 | 步骤较多 |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `INSTALL_DIR` | 安装目录 | `~/.opencode-zh` |
| `OPENCODE_VERSION` | 版本 | `latest` |
| `BRANCH` | Git 分支 | `main` |

## 项目结构

```
opencode-zh/
├── bin/
│   └── opencode-zh.js    # NPM 启动器
├── scripts/
│   └── postinstall.js    # 安装后脚本
├── translations/
│   └── zh-CN.json        # 中文翻译字典
├── install.sh            # 一键安装脚本
├── update.sh             # 更新脚本
├── localize.ts           # 汉化脚本
├── package.json
└── README.md
```

## 翻译格式

翻译格式：`原文 中文翻译`

```json
{
  "Show tips": "Show tips 显示提示",
  "Hide sidebar": "Hide sidebar 隐藏侧边栏"
}
```

## 常见问题

### Q: 安装后命令不可用？

A: 运行 `source ~/.bashrc` 或重新打开终端。

### Q: 升级后汉化丢失？

A: 运行更新命令或重新安装即可。

### Q: 部分内容仍显示英文？

A: 可能是：
1. 新增内容尚未翻译 - 可以提交 Issue 报告
2. 动态加载的 Skills - 需要在本地创建同名 Skills 覆盖

### Q: 如何恢复英文版？

A: 直接运行官方版本：
```bash
npx opencode-ai
# 或
bunx opencode-ai
```

### Q: 支持哪些平台？

A: 支持 Linux (x64, arm64)、macOS (x64, arm64)、Windows (x64)

## 贡献翻译

1. Fork 本仓库
2. 编辑 `translations/zh-CN.json`
3. 提交 Pull Request

## 许可证

MIT License

## 致谢

- [OpenCode](https://github.com/anomalyco/opencode) - 原始项目
