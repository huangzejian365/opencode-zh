# OpenCode 中文翻译插件

OpenCode 的中文本地化插件，为已安装的 OpenCode 提供中文界面支持。

## 重要说明

> **翻译原理**：本插件通过替换 OpenCode 源码中的文本实现汉化，因此需要**从源码构建** OpenCode。
> 
> - 如果您**已安装** `opencode-ai`（npm 全局安装），运行 `opencode-cn-localize` 会提示您选择安装中文版
> - 安装中文版后，原版 `opencode-ai` 仍可通过 `npx opencode-ai` 运行
> - 无法在已安装的 `opencode-ai` 基础上直接翻译（因为是预编译二进制）

## 功能特点

- 模块化翻译配置，易于维护
- 自动检测 OpenCode 安装路径
- **版本匹配检测** - 自动检测 OpenCode 版本是否与翻译插件兼容
- **自动安装 OpenCode** - 未安装时可自动克隆并安装
- **升级支持** - 支持升级 OpenCode 并重新应用翻译
- 精确文件定位，避免误替换

## 前置要求

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Bun](https://bun.sh/)（安装脚本会自动安装）
- [Git](https://git-scm.com/)

## 快速开始

### 情况 A：未安装过 OpenCode（推荐）

```bash
# 1. 安装翻译工具
npm install -g opencode-cn

# 2. 一键完成：下载 OpenCode + 应用中文翻译 + 构建
opencode-cn-localize --install

# 3. 启动中文版
opencode
```

### 情况 B：已安装 opencode-ai（npm 全局安装）

```bash
# 1. 安装翻译工具
npm install -g opencode-cn

# 2. 运行检测（会提示已检测到原版）
opencode-cn-localize

# 输出示例：
# ╔══════════════════════════════════════════════════════════════╗
# ║           检测到已安装的 OpenCode                            ║
# ║           Detected OpenCode Installation                     ║
# ╚══════════════════════════════════════════════════════════════╝
# ✓ 找到 OpenCode 1.2.15
#   位置：C:\Program Files\nodejs\opencode
#
# OpenCode 中文版需要从源码构建以支持翻译。
#
# 选择安装方式：
#   1. 安装中文版 (推荐): opencode-cn-localize --install
#   2. 继续使用原版 (不翻译): opencode

# 3. 安装中文版（会额外下载源码并构建）
opencode-cn-localize --install

# 4. 启动中文版（覆盖原版命令）
opencode

# 5. 如需使用原版
npx opencode-ai
```

> **说明**：安装中文版后，`opencode` 命令会启动中文版。原版可通过 `npx opencode-ai` 运行。

## 安装方式对比

| 方式 | 命令 | 说明 |
|------|------|------|
| **NPM**（推荐） | `npm install -g opencode-cn` | 最简单，自动管理依赖 |
| **Bun** | `bun install -g opencode-cn` | 速度快，需先安装 Bun |
| **手动** | `git clone` + `npm install` | 适合开发贡献 |

## 原版与中文版关系

| 项目 | opencode-ai（原版） | opencode-cn（中文版） |
|------|---------------------|----------------------|
| **安装方式** | `npm install -g opencode-ai` | `opencode-cn-localize --install` |
| **形式** | 预编译二进制 | 源码构建 |
| **翻译** | 英文界面 | 中文界面 |
| **命令冲突** | 安装中文版后会被覆盖 | 使用 `opencode` 启动 |
| **同时使用** | 可通过 `npx opencode-ai` 运行 | 可通过 `opencode` 运行 |
| **更新方式** | `npm update -g opencode-ai` | `opencode-cn-localize --upgrade` + `opencode-cn-localize` |

> **注意**：两者是独立的安装，互不影响。安装中文版会在 `~/.opencode-cn/opencode` 目录创建独立副本。

## 使用方法

### 首次安装（完整流程）

```bash
# 1. 安装翻译工具（见上文第1步）
npm install -g opencode-cn

# 2. 自动安装 OpenCode 并应用中文翻译
opencode-cn-localize --install

# 3. 启动 OpenCode
opencode
```

### 日常命令

### 命令参数

| 参数 | 说明 |
|------|------|
| `--install` | 自动安装 OpenCode 到 `~/.opencode-cn/opencode` |
| `--upgrade` | 升级 OpenCode 到最新版本 |
| `--no-build` | 仅翻译不构建 |

### 示例

```bash
# 自动安装 OpenCode
opencode-cn-localize --install

# 翻译并构建（默认）
opencode-cn-localize

# 仅翻译不构建
opencode-cn-localize --no-build

# 升级 OpenCode
opencode-cn-localize --upgrade

# 升级后重新翻译
opencode-cn-localize
```

## 版本匹配

运行翻译插件时，会自动检测 OpenCode 版本是否与翻译插件支持的版本匹配：

```
OpenCode version: 1.2.10
Translation config version: 1.2.10
✓ 版本匹配！OpenCode: 1.2.10
```

如果版本不匹配，会显示警告但不会阻止执行：

```
⚠ 版本不匹配！
   OpenCode: 1.2.11
   翻译插件: 1.2.10
   可能存在未翻译的内容
```

## 升级流程

当 OpenCode 发布新版本时：

```bash
# 1. 升级 OpenCode 源码
opencode-cn-localize --upgrade

# 2. 重新翻译并构建
opencode-cn-localize
```

> **注意**：升级后如果版本不匹配，可能存在未翻译的新内容。请关注翻译插件更新。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCODE_SOURCE_DIR` | OpenCode 源码目录 | 自动检测 |

### 自动检测路径顺序

1. `OPENCODE_SOURCE_DIR` 环境变量
2. `~/.opencode-cn/opencode`
3. `/root/opencode/packages/opencode`
4. `~/opencode/packages/opencode`
5. `~/.opencode/opencode/packages/opencode`

## 项目结构

```
opencode-cn/
├── translations/
│   ├── config.json              # 主配置文件
│   ├── app.json                 # 应用主入口
│   ├── dialogs/                 # 对话框组件
│   ├── components/              # UI 组件
│   ├── routes/                  # 路由页面
│   └── common/                  # 通用消息
├── localize.ts                  # 翻译脚本
├── tsconfig.json
└── package.json
```

## 翻译配置格式

每个翻译文件包含以下结构：

```json
{
  "file": "src/cli/cmd/tui/component/dialog-provider.tsx",
  "description": "提供商连接对话框",
  "replacements": {
    "title=\"Select auth method\"": "title=\"选择认证方式\"",
    "placeholder=\"API key\"": "placeholder=\"API密钥\""
  }
}
```

## 贡献翻译

1. Fork 本仓库
2. 在 `translations/` 目录下创建或编辑翻译文件
3. 更新 `translations/config.json` 中的版本号
4. 运行 `bun run localize.ts` 测试
5. 提交 Pull Request

## 常见问题

### Q: 翻译后部分内容仍显示英文？

A: 可能是：
1. 新增内容尚未翻译 - 可以提交 Issue 报告
2. 版本不匹配 - 检查 `translations/config.json` 中的版本是否与 OpenCode 一致

### Q: 如何恢复英文版？

A: 重新克隆或更新 OpenCode 源码：
```bash
rm -rf ~/.opencode-cn/opencode
opencode-cn-localize --install
```

### Q: 翻译脚本找不到 OpenCode？

A: 设置环境变量指定路径：
```bash
OPENCODE_SOURCE_DIR=/path/to/opencode opencode-cn-localize
```

### Q: 升级后翻译丢失？

A: 升级会重置源码，需要重新运行翻译：
```bash
opencode-cn-localize --upgrade
opencode-cn-localize
```

### Q: 支持哪些平台？

A: 支持 Linux (x64, arm64)、macOS (x64, arm64)、Windows (x64)

## 开发

```bash
# 克隆仓库
git clone https://github.com/huangzejian365/opencode-cn.git
cd opencode-cn

# 安装依赖
npm install

# 运行翻译脚本
OPENCODE_SOURCE_DIR=/path/to/opencode bun run localize.ts
```

## 许可证

MIT License

## 致谢

- [OpenCode](https://github.com/anomalyco/opencode) - 原始项目