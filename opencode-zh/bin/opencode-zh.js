#!/usr/bin/env node

const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")
const os = require("os")

const INSTALL_DIR = path.join(os.homedir(), ".opencode-zh")
const INSTALL_INFO = path.join(INSTALL_DIR, "install-info.json")

function getBinaryPath() {
  // 尝试从安装信息获取
  if (fs.existsSync(INSTALL_INFO)) {
    const info = JSON.parse(fs.readFileSync(INSTALL_INFO, "utf-8"))
    if (fs.existsSync(info.binaryPath)) {
      return info.binaryPath
    }
  }

  // 自动检测
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

  const binaryPath = path.join(
    INSTALL_DIR, 
    `opencode/packages/opencode/dist/${binaryName}/bin/opencode${platform === "win32" ? ".exe" : ""}`
  )
  
  if (fs.existsSync(binaryPath)) {
    return binaryPath
  }

  return null
}

function main() {
  const binaryPath = getBinaryPath()

  if (!binaryPath) {
    console.log("\x1b[31m错误: OpenCode 中文版未正确安装\x1b[0m")
    console.log("\x1b[33m请运行以下命令重新安装:\x1b[0m")
    console.log("  npm install -g opencode-zh")
    console.log("")
    console.log("或使用安装脚本:")
    console.log("  curl -fsSL https://raw.githubusercontent.com/opencode-zh/opencode-zh/main/install.sh | bash")
    process.exit(1)
  }

  const args = process.argv.slice(2)
  
  const result = spawn(binaryPath, args, {
    stdio: "inherit",
    env: process.env
  })

  result.on("close", (code) => {
    process.exit(code || 0)
  })
}

main()
