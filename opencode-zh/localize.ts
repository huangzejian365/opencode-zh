import fs from "fs"
import path from "path"

const OPENCODE_SRC_DIR = "/root/opencode/packages/opencode/src"
const TRANSLATIONS_FILE = path.join(__dirname, "translations", "zh-CN.json")

interface TranslationData {
  version: string
  translations: Record<string, string>
}

function loadTranslations(): TranslationData {
  const content = fs.readFileSync(TRANSLATIONS_FILE, "utf-8")
  return JSON.parse(content)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function applyTranslations(translations: Record<string, string>): number {
  let totalReplacements = 0
  
  const processFile = (filePath: string) => {
    let content = fs.readFileSync(filePath, "utf-8")
    let fileReplacements = 0
    
    for (const [original, translated] of Object.entries(translations)) {
      if (original === translated) continue
      
      const escapedOriginal = escapeRegex(original)
      
      const patterns = [
        { 
          regex: new RegExp(`(title:\\s*)"${escapedOriginal}"`, "g"), 
          replacement: `$1"${translated}"` 
        },
        { 
          regex: new RegExp(`(message:\\s*)"${escapedOriginal}"`, "g"), 
          replacement: `$1"${translated}"` 
        },
        { 
          regex: new RegExp(`(placeholder:\\s*)"${escapedOriginal}"`, "g"), 
          replacement: `$1"${translated}"` 
        },
        { 
          regex: new RegExp(`(label:\\s*)"${escapedOriginal}"`, "g"), 
          replacement: `$1"${translated}"` 
        },
        { 
          regex: new RegExp(`(description:\\s*)"${escapedOriginal}"`, "g"), 
          replacement: `$1"${translated}"` 
        },
        { 
          regex: new RegExp(`\\.show\\(\\s*\\{[^}]*message:\\s*"${escapedOriginal}"`, "g"), 
          replacement: `.show({ message: "${translated}"` 
        },
        { 
          regex: new RegExp(`>"${escapedOriginal}"<`, "g"), 
          replacement: `>"${translated}"<` 
        },
        { 
          regex: new RegExp(`>${escapedOriginal}</text>`, "g"), 
          replacement: `>${translated}</text>` 
        },
        { 
          regex: new RegExp(`"${escapedOriginal}"\\s*\\+`, "g"), 
          replacement: `"${translated}" +` 
        },
        { 
          regex: new RegExp(`\\+\\s*"${escapedOriginal}"`, "g"), 
          replacement: `+ "${translated}"` 
        },
      ]
      
      for (const { regex, replacement } of patterns) {
        const matches = content.match(regex)
        if (matches) {
          content = content.replace(regex, replacement)
          fileReplacements += matches.length
        }
      }
    }
    
    if (fileReplacements > 0) {
      fs.writeFileSync(filePath, content)
      console.log(`  ${path.relative(OPENCODE_SRC_DIR, filePath)}: ${fileReplacements} replacements`)
      totalReplacements += fileReplacements
    }
  }
  
  const walkDir = (dir: string) => {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        walkDir(filePath)
      } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
        processFile(filePath)
      }
    }
  }
  
  walkDir(OPENCODE_SRC_DIR)
  return totalReplacements
}

function getOpenCodeVersion(): string {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync("/root/opencode/packages/opencode/package.json", "utf-8")
    )
    return packageJson.version
  } catch {
    return "unknown"
  }
}

function main() {
  console.log("OpenCode Chinese Localization Tool")
  console.log("==================================\n")
  
  const currentVersion = getOpenCodeVersion()
  console.log(`Current OpenCode version: ${currentVersion}`)
  
  const translationData = loadTranslations()
  console.log(`Translation file version: ${translationData.version}`)
  console.log(`Translations loaded: ${Object.keys(translationData.translations).length} strings\n`)
  
  if (translationData.version !== currentVersion) {
    console.log(`Warning: Translation version mismatch!`)
    console.log(`  Translation file: ${translationData.version}`)
    console.log(`  Current version: ${currentVersion}`)
    console.log(`  Some strings may not be translated.\n`)
  }
  
  console.log("Applying translations...")
  const totalReplacements = applyTranslations(translationData.translations)
  
  console.log(`\nTotal replacements: ${totalReplacements}`)
  console.log("\nLocalization complete!")
}

main()
