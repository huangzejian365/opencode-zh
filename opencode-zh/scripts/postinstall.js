#!/usr/bin/env node

const { spawn, execSync, exec } = require("child_process")
const fs = require("fs")
const path = require("path")
const os = require("os")

const INSTALL_DIR = path.join(os.homedir(), ".opencode-zh")
const OPENCODE_DIR = path.join(INSTALL_DIR, "opencode")

const CYAN = "\x1b[36m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RED = "\x1b[31m"
const NC = "\x1b[0m"

function log(color, message) {
  console.log(`${color}${message}${NC}`)
}

function runCommand(command, cwd) {
  try {
    return execSync(command, { 
      cwd: cwd || process.cwd(), 
      stdio: "inherit",
      env: { ...process.env }
    })
  } catch (error) {
    throw error
  }
}

function checkCommand(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

async function install() {
  log(CYAN, "\n╔══════════════════════════════════════════════════════════════╗")
  log(CYAN, "║           OpenCode 中文版 安装程序                           ║")
  log(CYAN, "║           OpenCode Chinese Version Installer                 ║")
  log(CYAN, "╚══════════════════════════════════════════════════════════════╝\n")

  // 检查依赖
  log(CYAN, "[1/6] 检查系统环境...")
  
  if (!checkCommand("node")) {
    log(RED, "错误: 未找到 Node.js，请先安装 Node.js >= 18.0.0")
    log(YELLOW, "安装建议: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash - && sudo apt-get install -y nodejs")
    process.exit(1)
  }

  if (!checkCommand("bun")) {
    log(YELLOW, "未找到 Bun，正在安装...")
    runCommand("npm install -g bun")
  }

  if (!checkCommand("git")) {
    log(RED, "错误: 未找到 Git，请先安装 Git")
    process.exit(1)
  }

  log(GREEN, "✓ 环境检查完成\n")

  // 克隆源码
  log(CYAN, "[2/6] 克隆 OpenCode 源码...")
  
  if (fs.existsSync(OPENCODE_DIR)) {
    log(YELLOW, "目录已存在，正在更新...")
    runCommand("git fetch origin", OPENCODE_DIR)
    runCommand("git checkout main", OPENCODE_DIR)
    runCommand("git reset --hard origin/main", OPENCODE_DIR)
  } else {
    fs.mkdirSync(INSTALL_DIR, { recursive: true })
    runCommand("git clone --depth 1 https://github.com/anomalyco/opencode.git", INSTALL_DIR)
  }
  log(GREEN, "✓ 源码准备完成\n")

  // 安装依赖
  log(CYAN, "[3/6] 安装依赖...")
  runCommand("bun install", OPENCODE_DIR)
  log(GREEN, "✓ 依赖安装完成\n")

  // 应用汉化
  log(CYAN, "[4/6] 应用中文汉化...")
  const localizeScript = path.join(OPENCODE_DIR, "opencode-zh/localize.ts")
  if (fs.existsSync(localizeScript)) {
    runCommand(`bun run ${localizeScript}`, OPENCODE_DIR)
    log(GREEN, "✓ 汉化应用完成\n")
  } else {
    log(YELLOW, "⚠ 汉化脚本不存在，跳过\n")
  }

  // 构建
  log(CYAN, "[5/6] 构建 OpenCode...")
  runCommand("bun run build", path.join(OPENCODE_DIR, "packages/opencode"))
  log(GREEN, "✓ 构建完成\n")

  // 配置启动命令
  log(CYAN, "[6/6] 配置启动命令...")
  
  const platform = os.platform()
  const arch = os.arch()
  
  let binaryName
  if (platform === "linux") {
    binaryName = arch === "arm64" ? "opencode-linux-arm64" : "opencode-linux-x64"
  } else if (platform === "darwin") {
    binaryName = arch === "arm64" ? "opencode-darwin-arm64" : "opencode-darwin-x64"
  } else if (platform === "win32") {
    binaryName = "opencode-windows-x64"
  }

  const binaryPath = path.join(OPENCODE_DIR, `packages/opencode/dist/${binaryName}/bin/opencode${platform === "win32" ? ".exe" : ""}`)
  
  if (fs.existsSync(binaryPath)) {
    // 创建符号链接
    const binDir = path.join(os.homedir(), ".local/bin")
    fs.mkdirSync(binDir, { recursive: true })
    
    const linkPath = path.join(binDir, "opencode-zh")
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath)
    }
    fs.symlinkSync(binaryPath, linkPath)
    
    // 添加到 PATH
    const bashrc = path.join(os.homedir(), ".bashrc")
    const pathLine = `export PATH="$PATH:${binDir}"`
    if (!fs.readFileSync(bashrc, "utf8").includes(pathLine)) {
      fs.appendFileSync(bashrc, `\n${pathLine}\n`)
    }

    log(GREEN, "✓ 启动命令已创建: opencode-zh\n")
    
    // 保存安装信息
    const installInfo = {
      version: require("../package.json").version,
      binaryPath,
      installDir: INSTALL_DIR,
      installedAt: new Date().toISOString()
    }
    fs.writeFileSync(
      path.join(INSTALL_DIR, "install-info.json"),
      JSON.stringify(installInfo, null, 2)
    )
  } else {
    log(RED, `✗ 二进制文件不存在: ${binaryPath}`)
    process.exit(1)
  }

  log(GREEN, "\n╔══════════════════════════════════════════════════════════════╗")
  log(GREEN, "║                    安装完成！                                ║")
  log(GREEN, "║                  Installation Complete!                      ║")
  log(GREEN, "╠══════════════════════════════════════════════════════════════╣")
  log(GREEN, "║                                                              ║")
  log(GREEN, "║  启动方式:                                                   ║")
  log(GREEN, "║    source ~/.bashrc                                          ║")
  log(GREEN, "║    opencode-zh                                               ║")
  log(GREEN, "║                                                              ║")
  log(GREEN, "╚══════════════════════════════════════════════════════════════╝\n")
}

install().catch((error) => {
  log(RED, `\n安装失败: ${error.message}`)
  process.exit(1)
})
