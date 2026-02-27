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

## 十五、CI 流程中二进制文件未构建问题

### 问题描述
在 CI 环境中运行 `opencode-cn-localize --install` 后直接执行 `opencode`，提示二进制文件不存在：

```
错误: 未找到 OpenCode 二进制文件

请按以下步骤操作：
  1. 运行翻译命令: opencode-cn-localize
  2. 等待构建完成
  3. 再次运行: opencode
```

### 原因分析
原来的 `--install` 只完成：
1. 克隆源码
2. 安装依赖
3. 安装平台二进制包

但没有执行翻译和构建步骤，导致二进制文件不存在。

### 尝试过的方案

1. **分步执行** - 可行但不友好
```bash
opencode-cn-localize --install
opencode-cn-localize
```
用户需要执行两次命令，容易遗漏。

2. **CI 中运行 TUI 验证** - 失败
```bash
opencode  # 在非交互式终端中 TUI 无法正常运行
```
TUI 应用在 CI 环境中会以 exit code 1 退出。

3. **`--install` 自动完成翻译和构建** - 最终解决方案 ✓

### 最终解决方案

修改 `--install` 逻辑，自动完成完整流程：

```typescript
if (install) {
  // 1. 克隆源码
  await installOpenCode(installDir)
  
  // 2. 自动继续执行翻译和构建
  log(CYAN, "\n正在应用翻译并构建...")
  const opencodeDir = installDir
  
  // 应用翻译
  const moduleConfig = loadModuleConfig(translationsDir)
  // ... 翻译逻辑 ...
  
  // 构建二进制
  await buildOpenCode(opencodeDir)
  
  console.log("🎉 OpenCode 中文版已准备就绪！")
}
```

### CI 验证方式

在 CI 中使用 `--version` 验证而非启动 TUI：

```yaml
- name: Verify Installation
  run: |
    BINARY="$HOME/.opencode-cn/opencode/packages/opencode/node_modules/opencode-linux-x64/bin/opencode"
    "$BINARY" --version  # 正确的验证方式
    # 不要使用: opencode (TUI 在非交互终端会失败)
```

### 用户使用流程

现在用户只需一条命令：

```bash
npm install -g opencode-cn
opencode-cn-localize --install  # 完成所有步骤
opencode                        # 直接启动
```

---

## 十六、非交互式终端运行 TUI 问题

### 问题描述
在 CI 或非交互式终端中运行 `opencode`（TUI 应用），会显示帮助信息后以 exit code 1 退出。

### 原因
TUI 应用需要交互式终端来处理用户输入，在非交互环境（如 CI）中无法正常运行。

### 解决方案
在 CI 中使用以下命令验证安装：
- `opencode --version` - 检查版本
- `opencode --help` - 查看帮助
- 或直接调用二进制文件

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

---

## 十七、Windows 全局安装检测问题

### 问题描述
当用户已通过 `npm install -g opencode-ai` 安装官方版本后，运行 `opencode-cn-localize` 无法正确检测到已安装的 opencode，始终显示"未找到 OpenCode 安装目录"。

### 原因分析

1. **`where` 命令返回多行结果**
   - Windows 上 `where opencode` 返回：
     ```
     C:\Program Files\nodejs\opencode
     C:\Program Files\nodejs\opencode.cmd
     ```
   - 第一行不带扩展名，实际文件不存在

2. **原代码只取第一行**
   ```typescript
   const binaryPath = execSync(`${checkCmd} opencode`, { encoding: "utf-8" }).trim().split("\n")[0]
   ```
   - 获取到 `C:\Program Files\nodejs\opencode`（无扩展名）
   - `fs.existsSync(binaryPath)` 返回 false
   - 尝试添加扩展名但逻辑有缺陷

3. **版本检查失败**
   - 即使找到路径，执行 `"${binaryPath}" --version` 时，如果路径不正确也会失败

### 尝试过的方案

1. **只检查第一行并添加扩展名** - 失败
   - 第一行路径可能不是正确的可执行文件

2. **检查路径是否包含 nodejs/npm/nvm** - 部分成功
   - 可以判断是否全局安装，但无法获取版本

3. **遍历所有返回路径** - 最终解决方案 ✓

### 最终解决方案

```typescript
function getGlobalOpenCodeBinary(): { path: string; version: string } | null {
  const checkCmd = process.platform === "win32" ? "where" : "which"
  let output: string
  
  try {
    output = execSync(`${checkCmd} opencode`, { encoding: "utf-8" }).trim()
  } catch {
    return null
  }
  
  if (!output) {
    return null
  }
  
  const paths = output.split("\n").map(p => p.trim()).filter(p => p.length > 0)
  
  // 遍历所有返回的路径
  if (process.platform === "win32") {
    for (let rawPath of paths) {
      let binaryPath = rawPath
      
      // 检查文件是否直接存在
      if (fs.existsSync(binaryPath)) {
        let version: string
        try {
          version = execSync(`"${binaryPath}" --version`, { encoding: "utf-8" }).trim()
          return { path: binaryPath, version }
        } catch {
          continue
        }
      }
      
      // 尝试添加常见扩展名
      const extensions = [".cmd", ".exe", ".ps1", ".bat"]
      for (const ext of extensions) {
        const testPath = binaryPath + ext
        if (fs.existsSync(testPath)) {
          binaryPath = testPath
          break
        }
      }
      
      if (fs.existsSync(binaryPath)) {
        let version: string
        try {
          version = execSync(`"${binaryPath}" --version`, { encoding: "utf-8" }).trim()
          return { path: binaryPath, version }
        } catch {
          continue
        }
      }
    }
    return null
  }
  
  // Unix-like 系统
  const binaryPath = paths[0]
  if (!fs.existsSync(binaryPath)) {
    return null
  }
  
  const version = execSync(`"${binaryPath}" --version`, { encoding: "utf-8" }).trim()
  return { path: binaryPath, version }
}
```

### isNpmGlobalInstall 同步修复

```typescript
function isNpmGlobalInstall(): boolean {
  try {
    const checkCmd = process.platform === "win32" ? "where" : "which"
    let binaryPath = execSync(`${checkCmd} opencode`, { encoding: "utf-8" }).trim().split("\n")[0]
    
    if (process.platform === "win32") {
      // 同样需要处理扩展名
      if (!fs.existsSync(binaryPath)) {
        const extensions = [".cmd", ".exe", ".ps1", ".bat"]
        for (const ext of extensions) {
          if (fs.existsSync(binaryPath + ext)) {
            binaryPath = binaryPath + ext
            break
          }
        }
      }
      
      // Windows 全局安装特征
      return binaryPath.includes("nodejs") ||
             binaryPath.includes("node_modules") ||
             binaryPath.includes("npm") ||
             binaryPath.includes("nvm") ||
             binaryPath.endsWith(".ps1") ||
             binaryPath.endsWith(".cmd")
    }
    
    return binaryPath.includes("node_modules") || 
           binaryPath.includes("npm") ||
           binaryPath.includes("nvm")
  } catch {
    return false
  }
}
```

### 经验教训

1. **Windows 命令输出需要特殊处理**
   - `where` 返回多行，需要遍历所有结果
   - 文件扩展名可能缺失，需要尝试多种组合

2. **路径检查要完整**
   - 先检查原始路径
   - 再尝试添加扩展名
   - 最后验证能否执行获取版本

3. **错误处理要健壮**
   - 单个路径失败不意味着整体失败
   - 继续尝试其他路径

### 验证命令

```bash
# 查看 where 返回的所有路径
where opencode

# 检查实际存在的文件
dir "C:\Program Files\nodejs\opencode*"

# 测试版本命令
opencode --version
```
<task_progress>
- [x] 总结 Windows 检测逻辑修复错误
- [x] 更新 TROUBLESHOOTING.md
- [ ] 阅读 README.md
- [ ] 更新 README.md 安装和运行说明
</task_progress>