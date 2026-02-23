# OpenCode 中文翻译插件

OpenCode 的中文本地化插件，为已安装的 OpenCode 提供中文界面支持。

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

## 安装

### 方式一：NPM 安装（推荐）

```bash
npm install -g opencode-zh
```

### 方式二：Bun 安装

```bash
bun install -g opencode-zh
```

### 方式三：手动安装

```bash
# 克隆仓库
git clone https://github.com/opencode-zh/opencode-zh.git
cd opencode-zh/opencode-zh

# 安装依赖
npm install
```

## 使用方法

### 完整流程（推荐）

```bash
# 1. 自动安装 OpenCode（如果未安装）
opencode-zh-localize --install

# 2. 翻译并构建（一步完成）
opencode-zh-localize
```

### 命令参数

| 参数 | 说明 |
|------|------|
| `--install` | 自动安装 OpenCode 到 `~/.opencode-zh/opencode` |
| `--upgrade` | 升级 OpenCode 到最新版本 |
| `--no-build` | 仅翻译不构建 |

### 示例

```bash
# 自动安装 OpenCode
opencode-zh-localize --install

# 翻译并构建（默认）
opencode-zh-localize

# 仅翻译不构建
opencode-zh-localize --no-build

# 升级 OpenCode
opencode-zh-localize --upgrade

# 升级后重新翻译
opencode-zh-localize
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
opencode-zh-localize --upgrade

# 2. 重新翻译并构建
opencode-zh-localize
```

> **注意**：升级后如果版本不匹配，可能存在未翻译的新内容。请关注翻译插件更新。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCODE_SOURCE_DIR` | OpenCode 源码目录 | 自动检测 |

### 自动检测路径顺序

1. `OPENCODE_SOURCE_DIR` 环境变量
2. `~/.opencode-zh/opencode`
3. `/root/opencode/packages/opencode`
4. `~/opencode/packages/opencode`
5. `~/.opencode/opencode/packages/opencode`

## 项目结构

```
opencode-zh/
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
rm -rf ~/.opencode-zh/opencode
opencode-zh-localize --install
```

### Q: 翻译脚本找不到 OpenCode？

A: 设置环境变量指定路径：
```bash
OPENCODE_SOURCE_DIR=/path/to/opencode opencode-zh-localize
```

### Q: 升级后翻译丢失？

A: 升级会重置源码，需要重新运行翻译：
```bash
opencode-zh-localize --upgrade
opencode-zh-localize
```

### Q: 支持哪些平台？

A: 支持 Linux (x64, arm64)、macOS (x64, arm64)、Windows (x64)

## 开发

```bash
# 克隆仓库
git clone https://github.com/opencode-zh/opencode-zh.git
cd opencode-zh/opencode-zh

# 安装依赖
npm install

# 运行翻译脚本
OPENCODE_SOURCE_DIR=/path/to/opencode bun run localize.ts
```

## 许可证

MIT License

## 致谢

- [OpenCode](https://github.com/anomalyco/opencode) - 原始项目
