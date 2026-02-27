# OpenCode-CN 开发问题总结

本文档记录了开发过程中遇到的问题、尝试过的解决方案以及最终解决方法，供后续开发和 AI 辅助开发参考。

---

## 一、Windows 平台二进制文件执行问题（核心问题）

### 问题描述
在 Windows 上，`bin/opencode` 文件没有 `.exe` 扩展名，导致无法直接执行：
```
opencode.cmd : 无法将"opencode.cmd"项识别为 cmdlet、函数、脚本文件或可运行程序的名称
```

### 尝试过的方案

1. **尝试直接运行 bin/opencode** - 失败
   - Windows 无法识别无扩展名的可执行文件
   
2. **尝试通过 Node.js spawn 执行** - 失败
   - 仍然无法执行无扩展名文件

3. **创建 opencode.cmd 包装脚本** - 部分成功
   - 在构建后自动生成 `bin/opencode.cmd` 文件
   - 内容：`@echo off\n"path/to/opencode.exe" %*`
   - 但用户需要知道完整路径才能运行

4. **添加全局 `opencode` 命令** - 最终解决方案 ✓
   - 在 package.json 中添加 `"opencode": "dist/localize.js"`
   - 在 localize.ts 中检测命令名称，自动启动 OpenCode 二进制
   - 用户只需运行 `opencode` 即可启动

### 关键代码
```typescript
// 检测是否作为 opencode 命令运行
const execPath = process.argv[1] || ""
const isRunCommand = execPath.endsWith("opencode") || 
                     execPath.endsWith("opencode.exe") ||
                     execPath.endsWith("opencode.cmd")

if (isRunCommand) {
  const opencodeDir = getOpenCodeDir()
  if (opencodeDir) {
    runOpenCode(opencodeDir)
    return
  }
}
```

---

## 二、翻译文件路径查找问题

### 问题描述
翻译文件存放在 `translations/` 目录下，但代码运行时可能从不同位置启动，导致找不到翻译文件。

### 尝试过的方案

1. **使用相对路径** - 失败
   - 从不同目录运行时路径不正确

2. **使用 `__dirname`** - 部分成功
   - 编译后的 JS 文件在 `dist/` 目录，翻译文件不在同一层级

3. **多路径搜索** - 最终解决方案 ✓
```typescript
function getTranslationsDir(): string {
  const scriptDir = __dirname
  const possiblePaths = [
    path.join(scriptDir, "translations"),      // 当在项目根目录运行时
    path.join(scriptDir, "..", "translations"), // 当从 dist/ 运行时
    path.join(process.cwd(), "translations"),   // 当前工作目录
  ]
  
  for (const translationsDir of possiblePaths) {
    if (fs.existsSync(translationsDir)) {
      return translationsDir
    }
  }
  
  throw new Error(`Translations directory not found. Searched: ${possiblePaths.join(", ")}`)
}
```

---

## 三、Bun 安装和运行问题

### 问题描述
Windows 上 Bun 的安装和行为与 Linux/macOS 不同：
- `bun install` 可能因 husky 等 prepare 脚本失败
- Bun 安装后可能不在 PATH 中
- Windows 上 Bun 的行为与官方文档有差异

### 尝试过的方案

1. **直接使用 bun 命令** - 失败
   - Windows 上可能未正确安装或不在 PATH 中

2. **使用 npm run 替代 bun** - 放弃
   - 会有兼容性问题

3. **使用 `--ignore-scripts` 跳过 prepare 脚本** - 成功 ✓
```bash
bun install --ignore-scripts
```

4. **Windows 上使用 npx bun 作为备选** - 成功 ✓
```typescript
let bunCmd = "bun"
if (!checkCommand("bun")) {
  if (process.platform === "win32") {
    bunCmd = "npx bun"
  }
}
```

### husky 失败的具体错误
```
.husky/pre-commit: line 4: .: filename argument required
.: usage: . filename [arguments]
```
原因是 Windows 环境下 shell 脚本执行问题，使用 `--ignore-scripts` 可以绕过。

---

## 四、平台特定二进制包安装

### 问题描述
OpenCode 使用平台特定的二进制包，如 `opencode-windows-x64`、`opencode-darwin-arm64` 等。需要正确检测平台并安装对应包。

### 解决方案
动态检测平台并安装对应包：
```typescript
const platform = process.platform
const arch = process.arch

const platformMap: Record<string, string> = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows"
}
const archMap: Record<string, string> = {
  x64: "x64",
  arm64: "arm64",
  arm: "arm"
}

const packageName = `opencode-${platformName}-${archName}`
```

### 注意事项
- 使用 `--no-save` 避免修改 package.json
- 二进制包较大，下载可能需要时间

---

## 五、Git 克隆失败问题

### 问题描述
在某些网络环境下，Git 克隆可能失败或超时。

### 解决方案
1. 使用 `--depth 1` 浅克隆减少数据量
```bash
git clone --depth 1 https://github.com/anomalyco/opencode.git
```

2. 添加错误处理和重试提示

---

## 六、版本不匹配警告

### 问题描述
OpenCode 源码版本与翻译插件版本可能不一致，导致部分内容未翻译。

### 解决方案
在运行时检测并警告用户：
```typescript
if (currentVersion !== moduleConfig.version) {
  log(YELLOW, `⚠ 版本不匹配！`)
  log(YELLOW, `   OpenCode: ${currentVersion}`)
  log(YELLOW, `   翻译插件: ${moduleConfig.version}`)
  log(YELLOW, `   可能存在未翻译的内容`)
}
```

---

## 七、进程占用导致删除失败

### 问题描述
删除 `.opencode-cn` 目录时，opencode.exe 进程可能正在运行导致删除失败：
```
C:\Users\Administrator\.opencode-cn\opencode\packages\opencode\NODE_M~1\OPENCO~1\bin\opencode.exe - 拒绝访问。
```

### 解决方案
```bash
# 先终止进程
taskkill /f /im opencode.exe

# 再删除目录
rmdir /s /q C:\Users\Administrator\.opencode-cn
```

---

## 八、npm 发布和登录问题

### 问题描述
发布 npm 包需要登录认证，但交互式登录在自动化环境中困难。

### 解决方案
- 用户手动执行 `npm login` 完成 Web 认证
- 使用 OTP 或自动化 token 进行 CI/CD 发布

---

## 九、spawn 子进程执行问题

### 问题描述
使用 Node.js `spawn` 执行命令时，Windows 和 Unix 系统行为不同。

### 尝试过的方案

1. **不使用 shell 选项** - 失败
   - Windows 上某些命令无法执行

2. **使用 `shell: true`** - 成功 ✓
```typescript
const child = spawn(binaryPath, args, {
  stdio: "inherit",
  env: process.env,
  shell: true  // Windows 上必需
})
```

3. **命令字符串分割问题**
```typescript
// 错误方式
spawn("npx bun", ["install"])  // "npx bun" 会被当作一个命令

// 正确方式
const bunCmd = "npx bun"
spawn(bunCmd.split(" ")[0], bunCmd.split(" ").slice(1).concat(["install"]))
```

---

## 十、二进制文件路径查找问题

### 问题描述
构建后的二进制文件可能存在多个位置，需要正确查找。

### 解决方案
多路径搜索策略：
```typescript
const possiblePaths = [
  path.join(opencodeDir, "packages", "opencode", "node_modules", packageName, "bin", binaryName),
  path.join(opencodeDir, "packages", "opencode", "dist", packageName, "bin", binaryName),
]

let binaryPath: string | null = null
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    binaryPath = p
    break
  }
}
```

---

## 十一、OpenCode 源码目录查找问题

### 问题描述
需要找到 OpenCode 源码目录，但用户可能安装在不同位置。

### 解决方案
多路径搜索 + 环境变量支持：
```typescript
function getOpenCodeDir(): string | null {
  // 优先使用环境变量
  if (process.env.OPENCODE_SOURCE_DIR) {
    return process.env.OPENCODE_SOURCE_DIR
  }

  // 默认目录
  const homeDir = os.homedir()
  const defaultDir = path.join(homeDir, ".opencode-cn", "opencode")
  
  if (fs.existsSync(defaultDir)) {
    return defaultDir
  }

  // 其他可能路径
  const possiblePaths = [
    "/root/opencode/packages/opencode",
    path.join(homeDir, "opencode", "packages", "opencode"),
    path.join(homeDir, ".opencode", "packages", "opencode"),
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return path.dirname(path.dirname(p))
    }
  }

  return null
}
```

---

## 十二、构建后二进制文件复制问题

### 问题描述
构建完成后，二进制文件在 `dist/` 目录，但 `bin/opencode` 脚本期望在 `node_modules/` 中查找。

### 解决方案
构建后自动复制二进制文件：
```typescript
function copyBinaryToNodeModules(opencodeDir: string): void {
  const distBinaryPath = path.join(opencodeDir, "packages", "opencode", "dist", packageName, "bin", binaryName)
  const nodeModulesBinaryPath = path.join(opencodeDir, "packages", "opencode", "node_modules", packageName, "bin", binaryName)
  
  if (fs.existsSync(distBinaryPath)) {
    const targetDir = path.dirname(nodeModulesBinaryPath)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    fs.copyFileSync(distBinaryPath, nodeModulesBinaryPath)
  }
}
```

---

## 十三、正则表达式替换问题

### 问题描述
翻译时使用正则表达式替换文本，需要正确转义特殊字符。

### 解决方案
```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function applyTranslation(content: string, original: string, translated: string): string {
  if (original === translated) return content
  
  const escapedOriginal = escapeRegex(original)
  const regex = new RegExp(escapedOriginal, "g")
  return content.replace(regex, translated)
}
```

---

## 十四、TypeScript 编译和 __dirname 问题

### 问题描述
TypeScript 编译后，`__dirname` 指向 `dist/` 目录而不是项目根目录。

### 解决方案
- 使用多路径搜索（见问题二）
- 或在 tsconfig.json 中配置正确的输出目录

---

## 经验教训总结

### 1. Windows 兼容性是关键
Windows 与 Unix 系统差异大，需要特别处理：
- 文件扩展名（`.exe`, `.cmd`）
- 路径分隔符（`\` vs `/`）
- 命令执行方式（需要 `shell: true`）
- 进程管理（`taskkill` vs `kill`）

### 2. 多路径搜索策略
任何文件查找都应该考虑多个可能的位置，因为：
- 开发环境和生产环境不同
- 不同操作系统路径不同
- 安装方式不同导致路径不同

### 3. 错误处理要完善
每一步都需要：
- 检查操作是否成功
- 提供有意义的错误信息
- 给出解决方案提示

### 4. 渐进式解决
- 先解决最紧急的问题
- 再优化用户体验
- 最后添加锦上添花的功能

### 5. 测试很重要
- 使用 `npm link` 本地测试
- 跨平台测试
- 自动化测试

### 6. 文档记录
- 记录所有尝试过的方案（包括失败的）
- 记录最终解决方案的原因
- 方便后续维护和其他开发者参考

---

## 常用调试命令

```bash
# 检查命令是否存在
where bun          # Windows
which bun          # Unix

# 查看 npm 全局安装路径
npm root -g

# 查看 node_modules 中的包
ls node_modules/opencode-windows-x64/bin/

# 查看 package.json 的 bin 字段
npm bin

# 本地链接测试
npm link
npm unlink -g opencode-cn

# 终止进程
taskkill /f /im opencode.exe    # Windows
pkill -f opencode               # Unix
```

---

## 参考资源

- [OpenCode 官方仓库](https://github.com/anomalyco/opencode)
- [Bun 官方文档](https://bun.sh/docs)
- [Node.js spawn 文档](https://nodejs.org/api/child_process.html#child_process_spawn_command_args_options)
- [npm link 文档](https://docs.npmjs.com/cli/v9/commands/npm-link)