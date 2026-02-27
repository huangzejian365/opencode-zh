# 测试流程改进方案

## 问题分析

### 当前测试流程的痛点

1. **每次修改都需要发布 npm 才能测试**
   - 修改代码 → 构建 → 发布 npm → 卸载旧版本 → 安装新版本 → 测试
   - 整个流程耗时 2-5 分钟，且大部分时间浪费在 npm 操作上

2. **无法本地快速验证**
   - 全局命令（如 `opencode`）只有通过 npm 安装才能正确解析路径
   - 无法模拟真实的用户安装环境

3. **跨平台测试困难**
   - 需要在 Windows、macOS、Linux 上分别测试
   - 每个平台的测试流程都需要完整重复

---

## 改进方案

### 方案一：本地 npm 链接测试（推荐 ⭐）

使用 `npm link` 在本地创建全局命令软链接，无需发布即可测试。

```bash
# 在项目根目录执行
npm link

# 这会创建全局命令链接，可以直接测试
opencode-cn-localize --install
opencode-cn-localize
opencode

# 测试完成后取消链接
npm unlink -g opencode-cn
```

**优点**：
- 无需发布 npm
- 修改代码后只需 `npm run build` 即可测试
- 完全模拟全局安装环境

**实现步骤**：
1. 修改代码
2. `npm run build`
3. `npm link`（只需执行一次）
4. 直接测试命令
5. 修改代码后重复步骤 2-4

---

### 方案二：添加本地测试脚本

在 package.json 中添加测试脚本：

```json
{
  "scripts": {
    "test:local": "node dist/localize.js",
    "test:run": "node dist/localize.js --run",
    "test:install": "node dist/localize.js --install"
  }
}
```

**使用方法**：
```bash
npm run test:install  # 测试安装功能
npm run test:local    # 测试翻译功能
npm run test:run      # 测试运行功能
```

---

### 方案三：自动化测试用例

创建自动化测试脚本验证核心功能：

```typescript
// test/test.ts
import { execSync } from "child_process"
import fs from "fs"
import path from "path"

const tests = [
  {
    name: "命令可用性测试",
    run: () => {
      // 测试 opencode-cn-localize 命令是否存在
      const result = execSync("opencode-cn-localize --help", { encoding: "utf-8" })
      if (!result.includes("OpenCode")) {
        throw new Error("命令输出不正确")
      }
    }
  },
  {
    name: "翻译文件完整性测试",
    run: () => {
      const translationsDir = path.join(__dirname, "..", "translations")
      const requiredFiles = [
        "config.json",
        "app.json",
        "dialogs/dialog-provider.json"
      ]
      for (const file of requiredFiles) {
        if (!fs.existsSync(path.join(translationsDir, file))) {
          throw new Error(`缺少翻译文件: ${file}`)
        }
      }
    }
  },
  {
    name: "二进制文件检测测试",
    run: () => {
      const opencodeDir = process.env.OPENCODE_SOURCE_DIR
      if (!opencodeDir) {
        console.log("跳过：未设置 OPENCODE_SOURCE_DIR")
        return
      }
      // 检查二进制文件是否存在
    }
  }
]

// 运行测试
let passed = 0
let failed = 0

for (const test of tests) {
  try {
    test.run()
    console.log(`✓ ${test.name}`)
    passed++
  } catch (error) {
    console.log(`✗ ${test.name}: ${(error as Error).message}`)
    failed++
  }
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)
```

---

### 方案四：CI/CD 自动化测试

使用 GitHub Actions 在多个平台上自动测试：

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Link package
        run: npm link
      
      - name: Test commands
        run: |
          opencode-cn-localize --help
          opencode --help || echo "OpenCode not installed, expected"
```

**优点**：
- 自动在所有平台测试
- 无需手动操作
- Pull Request 时自动验证

---

### 方案五：Docker 容器测试

为不同平台创建 Docker 镜像进行测试：

```dockerfile
# Dockerfile.test
FROM node:18

# 安装 Bun
RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build
RUN npm link

# 测试命令
CMD ["opencode-cn-localize", "--help"]
```

```bash
# 构建并测试
docker build -f Dockerfile.test -t opencode-cn-test .
docker run opencode-cn-test
```

---

## 推荐的综合测试策略

### 开发阶段
1. 使用 `npm link` 进行本地快速测试
2. 使用 `npm run test:local` 进行功能测试
3. 修改代码后只需重新 build

### 提交前
1. 运行自动化测试脚本
2. 确保本地测试通过

### 发布后
1. GitHub Actions 自动在多平台测试
2. 如有问题，快速修复并发布新版本

---

## 测试流程对比

| 方案 | 耗时 | 平台覆盖 | 自动化程度 |
|------|------|----------|------------|
| 发布 npm 测试 | 2-5分钟 | 单平台 | 手动 |
| npm link 测试 | 10-30秒 | 单平台 | 手动 |
| 自动化测试脚本 | 5-10秒 | 单平台 | 半自动 |
| GitHub Actions | 3-5分钟 | 多平台 | 全自动 |
| Docker 测试 | 1-2分钟 | Linux | 半自动 |

---

## 立即可实施的改进

### 1. 添加 npm link 快速测试指南

在 README.md 中添加：

```markdown
## 本地开发测试

```bash
# 克隆仓库
git clone https://github.com/huangzejian365/opencode-cn.git
cd opencode-cn

# 安装依赖
npm install

# 构建
npm run build

# 创建全局链接（只需执行一次）
npm link

# 现在可以测试命令
opencode-cn-localize --install
opencode-cn-localize
opencode

# 测试完成后取消链接
npm unlink -g opencode-cn
```
```

### 2. 添加 package.json 测试脚本

```json
{
  "scripts": {
    "build": "tsc",
    "test": "node dist/localize.js",
    "test:install": "node dist/localize.js --install",
    "link": "npm link",
    "unlink": "npm unlink -g opencode-cn"
  }
}
```

### 3. 创建测试验证清单

每次修改后验证：
- [ ] `npm run build` 成功
- [ ] `opencode-cn-localize --install` 正常
- [ ] `opencode-cn-localize` 翻译成功
- [ ] `opencode` 启动正常
- [ ] 界面显示中文

---

## 总结

**最推荐：npm link + 本地测试脚本**

这种方式可以：
1. 无需发布即可测试全局命令
2. 快速迭代开发
3. 完全模拟用户安装环境
4. 节省大量时间

下次开发时，建议先执行 `npm link`，然后每次修改后：
```bash
npm run build && opencode
```

这样可以将测试循环从 2-5 分钟缩短到 10-30 秒！