#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const NC = "\x1b[0m";
function log(color, message) {
    console.log(`${color}${message}${NC}`);
}
function getOpenCodeDir() {
    if (process.env.OPENCODE_SOURCE_DIR) {
        return process.env.OPENCODE_SOURCE_DIR;
    }
    const homeDir = os_1.default.homedir();
    const defaultDir = path_1.default.join(homeDir, ".opencode-cn", "opencode");
    if (fs_1.default.existsSync(defaultDir)) {
        return defaultDir;
    }
    const possiblePaths = [
        "/root/opencode/packages/opencode",
        path_1.default.join(homeDir, "opencode", "packages", "opencode"),
        path_1.default.join(homeDir, ".opencode", "packages", "opencode"),
    ];
    for (const p of possiblePaths) {
        if (fs_1.default.existsSync(p)) {
            return path_1.default.dirname(path_1.default.dirname(p));
        }
    }
    return null;
}
function getTranslationsDir() {
    const scriptDir = __dirname;
    const translationsDir = path_1.default.join(scriptDir, "translations");
    if (fs_1.default.existsSync(translationsDir)) {
        return translationsDir;
    }
    throw new Error(`Translations directory not found: ${translationsDir}`);
}
function loadModuleConfig(translationsDir) {
    const configPath = path_1.default.join(translationsDir, "config.json");
    if (!fs_1.default.existsSync(configPath)) {
        throw new Error(`Module config not found: ${configPath}`);
    }
    return JSON.parse(fs_1.default.readFileSync(configPath, "utf-8"));
}
function loadTranslationFile(translationsDir, relativePath) {
    const filePath = path_1.default.join(translationsDir, relativePath);
    if (!fs_1.default.existsSync(filePath)) {
        console.log(`  Warning: Translation file not found: ${relativePath}`);
        return null;
    }
    return JSON.parse(fs_1.default.readFileSync(filePath, "utf-8"));
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function applyTranslation(opencodeDir, config, relativeFilePath) {
    const targetFile = relativeFilePath || config.file;
    if (!targetFile) {
        return { file: "unknown", replacements: 0, skipped: true, reason: "No file specified" };
    }
    let relativePath = targetFile;
    if (relativePath.startsWith("src/")) {
        relativePath = path_1.default.join("packages", "opencode", targetFile);
    }
    else if (!relativePath.startsWith("packages/")) {
        relativePath = path_1.default.join("packages", "opencode", targetFile);
    }
    const filePath = path_1.default.join(opencodeDir, relativePath);
    if (!fs_1.default.existsSync(filePath)) {
        return { file: targetFile, replacements: 0, skipped: true, reason: "File not found" };
    }
    let content = fs_1.default.readFileSync(filePath, "utf-8");
    let totalReplacements = 0;
    for (const [original, translated] of Object.entries(config.replacements)) {
        if (original === translated)
            continue;
        const escapedOriginal = escapeRegex(original);
        const regex = new RegExp(escapedOriginal, "g");
        const matches = content.match(regex);
        if (matches) {
            content = content.replace(regex, translated);
            totalReplacements += matches.length;
        }
    }
    if (totalReplacements > 0) {
        fs_1.default.writeFileSync(filePath, content);
    }
    return { file: targetFile, replacements: totalReplacements, skipped: false };
}
function getOpenCodeVersion(opencodeDir) {
    try {
        const packageJsonPath = path_1.default.join(opencodeDir, "packages", "opencode", "package.json");
        if (fs_1.default.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, "utf-8"));
            return packageJson.version;
        }
    }
    catch { }
    return "unknown";
}
function checkCommand(cmd) {
    try {
        // Use 'where' on Windows, 'which' on Unix-like systems
        const checkCmd = process.platform === "win32" ? "where" : "which";
        (0, child_process_1.execSync)(`${checkCmd} ${cmd}`, { stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
function installOpenCode(targetDir) {
    return new Promise((resolve, reject) => {
        log(CYAN, "\n[1/4] 检查系统环境...");
        if (!checkCommand("git")) {
            log(RED, "错误: 未找到 Git，请先安装 Git");
            reject(new Error("Git not found"));
            return;
        }
        let bunCmd = "bun";
        if (!checkCommand("bun")) {
            log(YELLOW, "未找到 Bun，正在安装...");
            try {
                (0, child_process_1.execSync)("npm install -g bun", { stdio: "inherit" });
                log(GREEN, "✓ Bun 安装完成\n");
                // On Windows, try to use npx bun after installation
                if (process.platform === "win32") {
                    bunCmd = "npx bun";
                    log(YELLOW, "使用 npx bun 运行...\n");
                }
            }
            catch (error) {
                log(RED, "Bun 安装失败");
                reject(error);
                return;
            }
        }
        else {
            log(GREEN, "✓ 环境检查完成\n");
        }
        log(CYAN, "[2/4] 克隆 OpenCode 源码...");
        const cloneProcess = (0, child_process_1.spawn)("git", ["clone", "--depth", "1", "https://github.com/anomalyco/opencode.git", targetDir], {
            stdio: "inherit"
        });
        cloneProcess.on("close", (code) => {
            if (code !== 0) {
                log(RED, `克隆失败，退出码: ${code}`);
                reject(new Error(`Git clone failed with code ${code}`));
                return;
            }
            log(GREEN, "✓ 源码克隆完成\n");
            log(CYAN, "[3/4] 安装依赖...");
            // First install with --ignore-scripts to avoid husky errors
            // Then we'll do a full install for building later
            const installArgs = ["install", "--ignore-scripts"];
            // Handle both "bun" and "npx bun" cases properly
            let cmd;
            let args;
            if (bunCmd.includes(" ")) {
                // For commands like "npx bun", use shell execution
                cmd = process.platform === "win32" ? "cmd" : "sh";
                args = ["/c", bunCmd].concat(installArgs);
            }
            else {
                cmd = bunCmd;
                args = installArgs;
            }
            const installProcess = (0, child_process_1.spawn)(cmd, args, {
                cwd: targetDir,
                stdio: "inherit",
                shell: !bunCmd.includes(" ")
            });
            installProcess.on("close", (code) => {
                if (code !== 0) {
                    log(RED, `依赖安装失败，退出码: ${code}`);
                    reject(new Error(`Bun install failed with code ${code}`));
                    return;
                }
                log(GREEN, "✓ 依赖安装完成\n");
                log(CYAN, "[4/4] 检查版本匹配...");
                const installedVersion = getOpenCodeVersion(targetDir);
                const translationsDir = getTranslationsDir();
                const moduleConfig = loadModuleConfig(translationsDir);
                if (installedVersion === moduleConfig.version) {
                    log(GREEN, `✓ 版本匹配！OpenCode: ${installedVersion}\n`);
                    resolve(true);
                }
                else {
                    log(YELLOW, `⚠ 版本不匹配！`);
                    log(YELLOW, `   OpenCode: ${installedVersion}`);
                    log(YELLOW, `   翻译插件: ${moduleConfig.version}`);
                    log(YELLOW, `   可能存在未翻译的内容\n`);
                    resolve(true);
                }
            });
            installProcess.on("error", (error) => {
                log(RED, `依赖安装错误: ${error.message}`);
                reject(error);
            });
        });
        cloneProcess.on("error", (error) => {
            log(RED, `克隆错误: ${error.message}`);
            reject(error);
        });
    });
}
function upgradeOpenCode(opencodeDir) {
    return new Promise((resolve, reject) => {
        log(CYAN, "\n[1/3] 拉取最新代码...");
        const fetchProcess = (0, child_process_1.spawn)("git", ["fetch", "origin"], {
            cwd: opencodeDir,
            stdio: "inherit"
        });
        fetchProcess.on("close", (code) => {
            if (code !== 0) {
                log(RED, `拉取失败，退出码: ${code}`);
                reject(new Error(`Git fetch failed with code ${code}`));
                return;
            }
            log(GREEN, "✓ 代码拉取完成\n");
            log(CYAN, "[2/3] 检查版本...");
            const currentVersion = getOpenCodeVersion(opencodeDir);
            const translationsDir = getTranslationsDir();
            const moduleConfig = loadModuleConfig(translationsDir);
            try {
                const latestVersion = (0, child_process_1.execSync)("git describe --tags --abbrev=0 origin/main", {
                    cwd: opencodeDir,
                    encoding: "utf-8"
                }).trim().replace(/^v/, "");
                log(YELLOW, `   当前版本: ${currentVersion}`);
                log(YELLOW, `   最新版本: ${latestVersion}`);
                if (currentVersion === latestVersion) {
                    log(GREEN, "✓ 已经是最新版本\n");
                    resolve(true);
                    return;
                }
            }
            catch {
                log(YELLOW, "   无法获取最新版本信息\n");
            }
            log(CYAN, "[3/3] 更新并重新安装依赖...");
            const resetProcess = (0, child_process_1.spawn)("git", ["reset", "--hard", "origin/main"], {
                cwd: opencodeDir,
                stdio: "inherit"
            });
            resetProcess.on("close", (code) => {
                if (code !== 0) {
                    log(RED, `更新失败，退出码: ${code}`);
                    reject(new Error(`Git reset failed with code ${code}`));
                    return;
                }
                const bunCmd = process.platform === "win32" && !checkCommand("bun") ? "npx bun" : "bun";
                const installProcess = (0, child_process_1.spawn)(bunCmd.split(" ")[0], bunCmd.split(" ").slice(1).concat(["install"]), {
                    cwd: opencodeDir,
                    stdio: "inherit",
                    shell: true
                });
                installProcess.on("close", (code) => {
                    if (code !== 0) {
                        log(RED, `依赖安装失败，退出码: ${code}`);
                        reject(new Error(`Bun install failed with code ${code}`));
                        return;
                    }
                    const newVersion = getOpenCodeVersion(opencodeDir);
                    log(GREEN, `✓ 更新完成！新版本: ${newVersion}\n`);
                    if (newVersion !== moduleConfig.version) {
                        log(YELLOW, `⚠ 版本不匹配！`);
                        log(YELLOW, `   OpenCode: ${newVersion}`);
                        log(YELLOW, `   翻译插件: ${moduleConfig.version}`);
                        log(YELLOW, `   可能存在未翻译的内容\n`);
                    }
                    resolve(true);
                });
                installProcess.on("error", (error) => {
                    log(RED, `依赖安装错误: ${error.message}`);
                    reject(error);
                });
            });
            resetProcess.on("error", (error) => {
                log(RED, `更新错误: ${error.message}`);
                reject(error);
            });
        });
        fetchProcess.on("error", (error) => {
            log(RED, `拉取错误: ${error.message}`);
            reject(error);
        });
    });
}
function buildOpenCode(opencodeDir) {
    return new Promise((resolve, reject) => {
        console.log("\nBuilding OpenCode...");
        const bunCmd = process.platform === "win32" && !checkCommand("bun") ? "npx bun" : "bun";
        const buildProcess = (0, child_process_1.spawn)(bunCmd.split(" ")[0], bunCmd.split(" ").slice(1).concat(["run", "build"]), {
            cwd: path_1.default.join(opencodeDir, "packages", "opencode"),
            stdio: "inherit",
            env: process.env,
            shell: true
        });
        buildProcess.on("close", (code) => {
            if (code === 0) {
                console.log("\n✓ Build completed successfully!");
                resolve(code);
            }
            else {
                console.log(`\n✗ Build failed with exit code ${code}`);
                reject(new Error(`Build failed with exit code ${code}`));
            }
        });
        buildProcess.on("error", (error) => {
            console.error(`\n✗ Build error: ${error.message}`);
            reject(error);
        });
    });
}
async function main() {
    console.log("OpenCode Chinese Localization Tool");
    console.log("==================================\n");
    const args = process.argv.slice(2);
    const noBuild = args.includes("--no-build");
    const upgrade = args.includes("--upgrade");
    const install = args.includes("--install");
    if (install) {
        log(CYAN, "╔══════════════════════════════════════════════════════════════╗");
        log(CYAN, "║           OpenCode 中文版 安装程序                           ║");
        log(CYAN, "║           OpenCode Chinese Version Installer                 ║");
        log(CYAN, "╚══════════════════════════════════════════════════════════════╝\n");
        const homeDir = os_1.default.homedir();
        const installDir = path_1.default.join(homeDir, ".opencode-cn", "opencode");
        try {
            await installOpenCode(installDir);
            console.log("\n╔══════════════════════════════════════════════════════════════╗");
            console.log("║                    安装完成！                                ║");
            console.log("║                  Installation Complete!                      ║");
            console.log("╠══════════════════════════════════════════════════════════════╣");
            console.log("║                                                              ║");
            console.log("║  下一步:                                                      ║");
            console.log("║    opencode-cn-localize                                          ║");
            console.log("║                                                              ║");
            console.log("╚══════════════════════════════════════════════════════════════╝\n");
        }
        catch (error) {
            log(RED, `\n安装失败: ${error.message}`);
            process.exit(1);
        }
        return;
    }
    if (upgrade) {
        log(CYAN, "╔══════════════════════════════════════════════════════════════╗");
        log(CYAN, "║           OpenCode 中文版 升级程序                           ║");
        log(CYAN, "║           OpenCode Chinese Version Upgrader                 ║");
        log(CYAN, "╚══════════════════════════════════════════════════════════════╝\n");
        let opencodeDir;
        try {
            opencodeDir = getOpenCodeDir();
            if (!opencodeDir) {
                log(RED, "错误: 未找到 OpenCode 安装目录");
                log(YELLOW, "请先运行: opencode-cn-localize --install");
                process.exit(1);
                return;
            }
            console.log(`OpenCode directory: ${opencodeDir}`);
        }
        catch (e) {
            log(RED, `Error: ${e.message}`);
            process.exit(1);
        }
        try {
            await upgradeOpenCode(opencodeDir);
            console.log("\n╔══════════════════════════════════════════════════════════════╗");
            console.log("║                    升级完成！                                ║");
            console.log("║                  Upgrade Complete!                          ║");
            console.log("╠══════════════════════════════════════════════════════════════╣");
            console.log("║                                                              ║");
            console.log("║  下一步:                                                      ║");
            console.log("║    opencode-cn-localize                                          ║");
            console.log("║                                                              ║");
            console.log("╚══════════════════════════════════════════════════════════════╝\n");
        }
        catch (error) {
            log(RED, `\n升级失败: ${error.message}`);
            process.exit(1);
        }
        return;
    }
    if (noBuild) {
        console.log("Running in translation-only mode (--no-build)\n");
    }
    let opencodeDir;
    try {
        opencodeDir = getOpenCodeDir();
        if (!opencodeDir) {
            log(RED, "错误: 未找到 OpenCode 安装目录");
            log(YELLOW, "\n请选择以下方式之一：");
            log(YELLOW, "  1. 设置环境变量: export OPENCODE_SOURCE_DIR=/path/to/opencode");
            log(YELLOW, "  2. 自动安装: opencode-cn-localize --install");
            process.exit(1);
        }
        console.log(`OpenCode directory: ${opencodeDir}`);
    }
    catch (e) {
        log(RED, `Error: ${e.message}`);
        process.exit(1);
    }
    const currentVersion = getOpenCodeVersion(opencodeDir);
    console.log(`OpenCode version: ${currentVersion}`);
    const translationsDir = getTranslationsDir();
    console.log(`Translations directory: ${translationsDir}\n`);
    const moduleConfig = loadModuleConfig(translationsDir);
    console.log(`Translation config version: ${moduleConfig.version}`);
    if (currentVersion !== moduleConfig.version) {
        log(YELLOW, `⚠ 版本不匹配！`);
        log(YELLOW, `   OpenCode: ${currentVersion}`);
        log(YELLOW, `   翻译插件: ${moduleConfig.version}`);
        log(YELLOW, `   可能存在未翻译的内容\n`);
    }
    else {
        log(GREEN, `✓ 版本匹配！OpenCode: ${currentVersion}\n`);
    }
    console.log("Applying translations...\n");
    const stats = {
        filesProcessed: 0,
        filesSkipped: 0,
        totalReplacements: 0,
        errors: []
    };
    const processModule = (category, files) => {
        console.log(`[${category}]`);
        for (const file of files) {
            const config = loadTranslationFile(translationsDir, file);
            if (!config) {
                stats.filesSkipped++;
                continue;
            }
            const result = applyTranslation(opencodeDir, config);
            if (result.skipped) {
                console.log(`  ⊘ ${result.file} (${result.reason})`);
                stats.filesSkipped++;
            }
            else if (result.replacements > 0) {
                console.log(`  ✓ ${result.file} (${result.replacements} replacements)`);
                stats.filesProcessed++;
                stats.totalReplacements += result.replacements;
            }
            else {
                console.log(`  - ${result.file} (no matches)`);
                stats.filesProcessed++;
            }
        }
        console.log("");
    };
    const modules = moduleConfig.modules;
    if (modules.root) {
        processModule("root", modules.root);
    }
    if (modules.dialogs) {
        processModule("dialogs", modules.dialogs);
    }
    if (modules.components) {
        processModule("components", modules.components);
    }
    if (modules.routes) {
        processModule("routes", modules.routes);
    }
    if (modules.common) {
        processModule("common", modules.common);
    }
    console.log("==================================");
    console.log(`Summary:`);
    console.log(`  Files processed: ${stats.filesProcessed}`);
    console.log(`  Files skipped: ${stats.filesSkipped}`);
    console.log(`  Total replacements: ${stats.totalReplacements}`);
    console.log("\nLocalization complete!");
    if (!noBuild) {
        try {
            await buildOpenCode(opencodeDir);
            console.log("\n🎉 OpenCode 中文版已准备就绪！");
            console.log("   启动命令: opencode");
        }
        catch (error) {
            console.error("\n构建失败，但翻译已完成。您可以手动运行构建命令：");
            console.error(`  cd ${path_1.default.join(opencodeDir, "packages", "opencode")} && bun run build`);
            process.exit(1);
        }
    }
}
main();
//# sourceMappingURL=localize.js.map