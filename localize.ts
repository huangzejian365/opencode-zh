#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { spawn, execSync } from "child_process"

// __dirname is available in CommonJS after compilation

interface TranslationConfig {
  file?: string
  description?: string
  replacements: Record<string, string>
}

interface ModuleConfig {
  name: string
  version: string
  description: string
  modules: {
    dialogs?: string[]
    components?: string[]
    routes?: string[]
    common?: string[]
    root?: string[]
  }
}

const CYAN = "\x1b[36m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RED = "\x1b[31m"
const NC = "\x1b[0m"

function log(color: string, message: string) {
  console.log(`${color}${message}${NC}`)
}

function getOpenCodeDir(): string | null {
  if (process.env.OPENCODE_SOURCE_DIR) {
    return process.env.OPENCODE_SOURCE_DIR
  }

  const homeDir = os.homedir()
  const defaultDir = path.join(homeDir, ".opencode-cn", "opencode")
  
  if (fs.existsSync(defaultDir)) {
    return defaultDir
  }

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

function getTranslationsDir(): string {
  const scriptDir = __dirname
  const translationsDir = path.join(scriptDir, "translations")
  
  if (fs.existsSync(translationsDir)) {
    return translationsDir
  }
  
  throw new Error(`Translations directory not found: ${translationsDir}`)
}

function loadModuleConfig(translationsDir: string): ModuleConfig {
  const configPath = path.join(translationsDir, "config.json")
  if (!fs.existsSync(configPath)) {
    throw new Error(`Module config not found: ${configPath}`)
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"))
}

function loadTranslationFile(translationsDir: string, relativePath: string): TranslationConfig | null {
  const filePath = path.join(translationsDir, relativePath)
  if (!fs.existsSync(filePath)) {
    console.log(`  Warning: Translation file not found: ${relativePath}`)
    return null
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"))
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function applyTranslation(
  opencodeDir: string,
  config: TranslationConfig,
  relativeFilePath?: string
): { file: string; replacements: number; skipped: boolean; reason?: string } {
  const targetFile = relativeFilePath || config.file
  
  if (!targetFile) {
    return { file: "unknown", replacements: 0, skipped: true, reason: "No file specified" }
  }

  let relativePath = targetFile
  if (relativePath.startsWith("src/")) {
    relativePath = path.join("packages", "opencode", targetFile)
  } else if (!relativePath.startsWith("packages/")) {
    relativePath = path.join("packages", "opencode", targetFile)
  }

  const filePath = path.join(opencodeDir, relativePath)
  
  if (!fs.existsSync(filePath)) {
    return { file: targetFile, replacements: 0, skipped: true, reason: "File not found" }
  }

  let content = fs.readFileSync(filePath, "utf-8")
  let totalReplacements = 0

  for (const [original, translated] of Object.entries(config.replacements)) {
    if (original === translated) continue
    
    const escapedOriginal = escapeRegex(original)
    const regex = new RegExp(escapedOriginal, "g")
    const matches = content.match(regex)
    
    if (matches) {
      content = content.replace(regex, translated)
      totalReplacements += matches.length
    }
  }

  if (totalReplacements > 0) {
    fs.writeFileSync(filePath, content)
  }

  return { file: targetFile, replacements: totalReplacements, skipped: false }
}

function getOpenCodeVersion(opencodeDir: string): string {
  try {
    const packageJsonPath = path.join(opencodeDir, "packages", "opencode", "package.json")
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
      return packageJson.version
    }
  } catch {}
  return "unknown"
}

function checkCommand(cmd: string): boolean {
  try {
    // Use 'where' on Windows, 'which' on Unix-like systems
    const checkCmd = process.platform === "win32" ? "where" : "which"
    execSync(`${checkCmd} ${cmd}`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function installOpenCode(targetDir: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    log(CYAN, "\n[1/4] 检查系统环境...")
    
    if (!checkCommand("git")) {
      log(RED, "错误: 未找到 Git，请先安装 Git")
      reject(new Error("Git not found"))
      return
    }

    let bunCmd = "bun"
    if (!checkCommand("bun")) {
      log(YELLOW, "未找到 Bun，正在安装...")
      try {
        execSync("npm install -g bun", { stdio: "inherit" })
        log(GREEN, "✓ Bun 安装完成\n")
        
        // On Windows, try to use npx bun after installation
        if (process.platform === "win32") {
          bunCmd = "npx bun"
          log(YELLOW, "使用 npx bun 运行...\n")
        }
      } catch (error) {
        log(RED, "Bun 安装失败")
        reject(error)
        return
      }
    } else {
      log(GREEN, "✓ 环境检查完成\n")
    }

    log(CYAN, "[2/4] 克隆 OpenCode 源码...")
    const cloneProcess = spawn("git", ["clone", "--depth", "1", "https://github.com/anomalyco/opencode.git", targetDir], {
      stdio: "inherit"
    })

    cloneProcess.on("close", (code) => {
      if (code !== 0) {
        log(RED, `克隆失败，退出码: ${code}`)
        reject(new Error(`Git clone failed with code ${code}`))
        return
      }

      log(GREEN, "✓ 源码克隆完成\n")

      log(CYAN, "[3/4] 安装依赖...")
      // Use --ignore-scripts to avoid husky and other prepare script errors
      const installArgs = ["install", "--ignore-scripts"]
      
      const installProcess = spawn(bunCmd, installArgs, {
        cwd: targetDir,
        stdio: "inherit",
        shell: true
      })

      installProcess.on("close", (code) => {
        if (code !== 0) {
          log(RED, `依赖安装失败，退出码: ${code}`)
          reject(new Error(`Bun install failed with code ${code}`))
          return
        }

        log(GREEN, "✓ 依赖安装完成\n")
        log(CYAN, "[4/4] 检查版本匹配...")
        
        const installedVersion = getOpenCodeVersion(targetDir)
        const translationsDir = getTranslationsDir()
        const moduleConfig = loadModuleConfig(translationsDir)
        
        if (installedVersion === moduleConfig.version) {
          log(GREEN, `✓ 版本匹配！OpenCode: ${installedVersion}\n`)
          resolve(true)
        } else {
          log(YELLOW, `⚠ 版本不匹配！`)
          log(YELLOW, `   OpenCode: ${installedVersion}`)
          log(YELLOW, `   翻译插件: ${moduleConfig.version}`)
          log(YELLOW, `   可能存在未翻译的内容\n`)
          resolve(true)
        }
      })

      installProcess.on("error", (error) => {
        log(RED, `依赖安装错误: ${error.message}`)
        reject(error)
      })
    })

    cloneProcess.on("error", (error) => {
      log(RED, `克隆错误: ${error.message}`)
      reject(error)
    })
  })
}

function upgradeOpenCode(opencodeDir: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    log(CYAN, "\n[1/3] 拉取最新代码...")
    
    const fetchProcess = spawn("git", ["fetch", "origin"], {
      cwd: opencodeDir,
      stdio: "inherit"
    })

    fetchProcess.on("close", (code) => {
      if (code !== 0) {
        log(RED, `拉取失败，退出码: ${code}`)
        reject(new Error(`Git fetch failed with code ${code}`))
        return
      }

      log(GREEN, "✓ 代码拉取完成\n")

      log(CYAN, "[2/3] 检查版本...")
      const currentVersion = getOpenCodeVersion(opencodeDir)
      const translationsDir = getTranslationsDir()
      const moduleConfig = loadModuleConfig(translationsDir)
      
      try {
        const latestVersion = execSync("git describe --tags --abbrev=0 origin/main", {
          cwd: opencodeDir,
          encoding: "utf-8"
        }).trim().replace(/^v/, "")
        
        log(YELLOW, `   当前版本: ${currentVersion}`)
        log(YELLOW, `   最新版本: ${latestVersion}`)
        
        if (currentVersion === latestVersion) {
          log(GREEN, "✓ 已经是最新版本\n")
          resolve(true)
          return
        }
      } catch {
        log(YELLOW, "   无法获取最新版本信息\n")
      }

      log(CYAN, "[3/3] 更新并重新安装依赖...")
      const resetProcess = spawn("git", ["reset", "--hard", "origin/main"], {
        cwd: opencodeDir,
        stdio: "inherit"
      })

      resetProcess.on("close", (code) => {
        if (code !== 0) {
          log(RED, `更新失败，退出码: ${code}`)
          reject(new Error(`Git reset failed with code ${code}`))
          return
        }

        const bunCmd = process.platform === "win32" && !checkCommand("bun") ? "npx bun" : "bun"
        const installProcess = spawn(bunCmd.split(" ")[0], bunCmd.split(" ").slice(1).concat(["install"]), {
          cwd: opencodeDir,
          stdio: "inherit",
          shell: true
        })

        installProcess.on("close", (code) => {
          if (code !== 0) {
            log(RED, `依赖安装失败，退出码: ${code}`)
            reject(new Error(`Bun install failed with code ${code}`))
            return
          }

          const newVersion = getOpenCodeVersion(opencodeDir)
          log(GREEN, `✓ 更新完成！新版本: ${newVersion}\n`)
          
          if (newVersion !== moduleConfig.version) {
            log(YELLOW, `⚠ 版本不匹配！`)
            log(YELLOW, `   OpenCode: ${newVersion}`)
            log(YELLOW, `   翻译插件: ${moduleConfig.version}`)
            log(YELLOW, `   可能存在未翻译的内容\n`)
          }
          
          resolve(true)
        })

        installProcess.on("error", (error) => {
          log(RED, `依赖安装错误: ${error.message}`)
          reject(error)
        })
      })

      resetProcess.on("error", (error) => {
        log(RED, `更新错误: ${error.message}`)
        reject(error)
      })
    })

    fetchProcess.on("error", (error) => {
      log(RED, `拉取错误: ${error.message}`)
      reject(error)
    })
  })
}

function buildOpenCode(opencodeDir: string): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log("\nBuilding OpenCode...")
    const bunCmd = process.platform === "win32" && !checkCommand("bun") ? "npx bun" : "bun"
    const buildProcess = spawn(bunCmd.split(" ")[0], bunCmd.split(" ").slice(1).concat(["run", "build"]), {
      cwd: path.join(opencodeDir, "packages", "opencode"),
      stdio: "inherit",
      env: process.env,
      shell: true
    })

    buildProcess.on("close", (code) => {
      if (code === 0) {
        console.log("\n✓ Build completed successfully!")
        resolve(code)
      } else {
        console.log(`\n✗ Build failed with exit code ${code}`)
        reject(new Error(`Build failed with exit code ${code}`))
      }
    })

    buildProcess.on("error", (error) => {
      console.error(`\n✗ Build error: ${error.message}`)
      reject(error)
    })
  })
}

async function main() {
  console.log("OpenCode Chinese Localization Tool")
  console.log("==================================\n")

  const args = process.argv.slice(2)
  const noBuild = args.includes("--no-build")
  const upgrade = args.includes("--upgrade")
  const install = args.includes("--install")

  if (install) {
    log(CYAN, "╔══════════════════════════════════════════════════════════════╗")
    log(CYAN, "║           OpenCode 中文版 安装程序                           ║")
    log(CYAN, "║           OpenCode Chinese Version Installer                 ║")
    log(CYAN, "╚══════════════════════════════════════════════════════════════╝\n")
    
    const homeDir = os.homedir()
    const installDir = path.join(homeDir, ".opencode-cn", "opencode")
    
    try {
      await installOpenCode(installDir)
      console.log("\n╔══════════════════════════════════════════════════════════════╗")
      console.log("║                    安装完成！                                ║")
      console.log("║                  Installation Complete!                      ║")
      console.log("╠══════════════════════════════════════════════════════════════╣")
      console.log("║                                                              ║");
      console.log("║  下一步:                                                      ║");
      console.log("║    opencode-cn-localize                                          ║");
      console.log("║                                                              ║");
      console.log("╚══════════════════════════════════════════════════════════════╝\n");
    } catch (error) {
      log(RED, `\n安装失败: ${(error as Error).message}`)
      process.exit(1)
    }
    return
  }

  if (upgrade) {
    log(CYAN, "╔══════════════════════════════════════════════════════════════╗")
    log(CYAN, "║           OpenCode 中文版 升级程序                           ║")
    log(CYAN, "║           OpenCode Chinese Version Upgrader                 ║")
    log(CYAN, "╚══════════════════════════════════════════════════════════════╝\n")
    
    let opencodeDir: string | null
    try {
      opencodeDir = getOpenCodeDir()
      if (!opencodeDir) {
        log(RED, "错误: 未找到 OpenCode 安装目录")
        log(YELLOW, "请先运行: opencode-cn-localize --install")
        process.exit(1)
        return
      }
      console.log(`OpenCode directory: ${opencodeDir}`)
    } catch (e) {
      log(RED, `Error: ${(e as Error).message}`)
      process.exit(1)
    }

    try {
      await upgradeOpenCode(opencodeDir)
      console.log("\n╔══════════════════════════════════════════════════════════════╗")
      console.log("║                    升级完成！                                ║");
      console.log("║                  Upgrade Complete!                          ║");
      console.log("╠══════════════════════════════════════════════════════════════╣");
      console.log("║                                                              ║");
      console.log("║  下一步:                                                      ║");
      console.log("║    opencode-cn-localize                                          ║");
      console.log("║                                                              ║");
      console.log("╚══════════════════════════════════════════════════════════════╝\n");
    } catch (error) {
      log(RED, `\n升级失败: ${(error as Error).message}`)
      process.exit(1)
    }
    return
  }

  if (noBuild) {
    console.log("Running in translation-only mode (--no-build)\n")
  }

  let opencodeDir: string | null
  try {
    opencodeDir = getOpenCodeDir()
    if (!opencodeDir) {
      log(RED, "错误: 未找到 OpenCode 安装目录")
      log(YELLOW, "\n请选择以下方式之一：")
      log(YELLOW, "  1. 设置环境变量: export OPENCODE_SOURCE_DIR=/path/to/opencode")
      log(YELLOW, "  2. 自动安装: opencode-cn-localize --install")
      process.exit(1)
    }
    console.log(`OpenCode directory: ${opencodeDir}`)
  } catch (e) {
    log(RED, `Error: ${(e as Error).message}`)
    process.exit(1)
  }

  const currentVersion = getOpenCodeVersion(opencodeDir)
  console.log(`OpenCode version: ${currentVersion}`)

  const translationsDir = getTranslationsDir()
  console.log(`Translations directory: ${translationsDir}\n`)

  const moduleConfig = loadModuleConfig(translationsDir)
  console.log(`Translation config version: ${moduleConfig.version}`)

  if (currentVersion !== moduleConfig.version) {
    log(YELLOW, `⚠ 版本不匹配！`)
    log(YELLOW, `   OpenCode: ${currentVersion}`)
    log(YELLOW, `   翻译插件: ${moduleConfig.version}`)
    log(YELLOW, `   可能存在未翻译的内容\n`)
  } else {
    log(GREEN, `✓ 版本匹配！OpenCode: ${currentVersion}\n`)
  }

  console.log("Applying translations...\n")

  const stats = {
    filesProcessed: 0,
    filesSkipped: 0,
    totalReplacements: 0,
    errors: [] as string[]
  }

  const processModule = (category: string, files: string[]) => {
    console.log(`[${category}]`)
    for (const file of files) {
      const config = loadTranslationFile(translationsDir, file)
      if (!config) {
        stats.filesSkipped++
        continue
      }

      const result = applyTranslation(opencodeDir, config)
      
      if (result.skipped) {
        console.log(`  ⊘ ${result.file} (${result.reason})`)
        stats.filesSkipped++
      } else if (result.replacements > 0) {
        console.log(`  ✓ ${result.file} (${result.replacements} replacements)`)
        stats.filesProcessed++
        stats.totalReplacements += result.replacements
      } else {
        console.log(`  - ${result.file} (no matches)`)
        stats.filesProcessed++
      }
    }
    console.log("")
  }

  const modules = moduleConfig.modules

  if (modules.root) {
    processModule("root", modules.root)
  }
  if (modules.dialogs) {
    processModule("dialogs", modules.dialogs)
  }
  if (modules.components) {
    processModule("components", modules.components)
  }
  if (modules.routes) {
    processModule("routes", modules.routes)
  }
  if (modules.common) {
    processModule("common", modules.common)
  }

  console.log("==================================")
  console.log(`Summary:`)
  console.log(`  Files processed: ${stats.filesProcessed}`)
  console.log(`  Files skipped: ${stats.filesSkipped}`)
  console.log(`  Total replacements: ${stats.totalReplacements}`)
  console.log("\nLocalization complete!")

  if (!noBuild) {
    try {
      await buildOpenCode(opencodeDir)
      console.log("\n🎉 OpenCode 中文版已准备就绪！")
      console.log("   启动命令: opencode")
    } catch (error) {
      console.error("\n构建失败，但翻译已完成。您可以手动运行构建命令：")
      console.error(`  cd ${path.join(opencodeDir, "packages", "opencode")} && bun run build`)
      process.exit(1)
    }
  }
}

main()