#!/usr/bin/env tsx
/**
 * translate-locale.ts
 *
 * Gera um novo arquivo de locale JSON traduzindo do pt-BR como origem,
 * usando o proprio openclaude SDK como motor de traducao.
 *
 * Uso: npm run translate -- xx-YY [--force]
 */

import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { prompt } from "../src/session-v2.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, "..")

// ---------------------------------------------------------------------------
// Argumento e flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const locale = args.find((a) => !a.startsWith("--"))
const force = args.includes("--force")

if (!locale) {
  console.error("Uso: npm run translate -- xx-YY [--force]")
  console.error("Exemplo: npm run translate -- pt-PT")
  process.exit(1)
}

// Validacao BCP 47 basica
const BCP47_RE = /^[a-z]{2}-[A-Z]{2}$/i
if (!BCP47_RE.test(locale)) {
  console.error(
    `Formato invalido: "${locale}". Esperado formato BCP 47 xx-YY (ex: pt-PT, fr-FR, ja-JP).`,
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Caminhos
// ---------------------------------------------------------------------------

const LOCALES_DIR = resolve(ROOT, "src/tool-intention/locales")
const SRC_FILE = resolve(LOCALES_DIR, "pt-BR.json")
const DEST_FILE = resolve(LOCALES_DIR, `${locale}.json`)

// Verifica se destino ja existe
if (existsSync(DEST_FILE) && !force) {
  console.error(
    `Arquivo ${DEST_FILE} ja existe. Use --force para sobrescrever.`,
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Carrega origem
// ---------------------------------------------------------------------------

const ptBR = JSON.parse(readFileSync(SRC_FILE, "utf-8")) as Record<
  string,
  string[]
>
const toolNames = Object.keys(ptBR)

// ---------------------------------------------------------------------------
// Prompts de traducao
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Voce e um tradutor especializado em strings curtas de UI para software.
Sua tarefa: traduzir narrativas de acao de agente de IA do portugues
brasileiro (pt-BR) para o idioma de destino.

REGRAS:
- Preserve o TOM: discreto, funcional, no gerundio ou forma equivalente.
- Preserve o TAMANHO: maximo 6 palavras, similar ao original.
- Nao traduza literalmente — use a forma idiomatica do idioma destino.
- Preserve a neutralidade: sem emoji, sem girias, sem antropomorfismo.
- Nao adicione pontuacao final nas frases.

FORMATO DE SAIDA:
JSON array com exatamente o mesmo numero de strings que o input, na ordem.
Nada alem do JSON. Sem explicacao, sem markdown fence.

Exemplo de entrada:
["Executando um comando", "Rodando uma operacao no terminal"]

Exemplo de saida (idioma destino = en-US):
["Running a command", "Executing a terminal operation"]`

function buildUserPrompt(toolName: string, variants: string[]): string {
  return `Idioma destino: ${locale}
Tool: ${toolName}

Traduza estas ${variants.length} variantes do portugues para ${locale}:
${JSON.stringify(variants)}`
}

// ---------------------------------------------------------------------------
// Extrair JSON array da resposta (o modelo pode incluir texto antes/depois)
// ---------------------------------------------------------------------------

function extractJsonArray(text: string): unknown[] | null {
  // Tenta parse direto primeiro
  const trimmed = text.trim()
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // nao e JSON puro — tenta extrair do texto
  }

  // Procura o primeiro [ ... ] no texto
  const match = trimmed.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) return parsed
    } catch {
      // falhou
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Traducao por tool com retry
// ---------------------------------------------------------------------------

async function translateTool(
  toolName: string,
  variants: string[],
): Promise<string[] | null> {
  const userPrompt = buildUserPrompt(toolName, variants)

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await prompt(userPrompt, {
        systemPrompt: SYSTEM_PROMPT,
        permissionMode: "bypassPermissions",
        toolOutputMode: "full",
        presenceIntervalMs: 0,
        richOutput: false,
        mcpServers: {},
        locale: "en-US",
      })

      const text = result.result
      if (!text) {
        if (attempt === 1) process.stdout.write(` (retry ${attempt})`)
        continue
      }

      const parsed = extractJsonArray(text)
      if (!parsed) {
        if (attempt === 1) process.stdout.write(` (retry ${attempt})`)
        continue
      }

      // Valida: array de exatamente N strings (N = numero de variantes da origem)
      const expectedCount = variants.length
      if (
        parsed.length !== expectedCount ||
        !parsed.every((s) => typeof s === "string")
      ) {
        if (attempt === 1) process.stdout.write(` (retry ${attempt})`)
        continue
      }

      return parsed as string[]
    } catch {
      if (attempt === 1) process.stdout.write(` (retry ${attempt})`)
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\nTraduzindo pt-BR → ${locale}...`)
  console.log(`Origem: ${SRC_FILE}`)
  console.log(`Destino: ${DEST_FILE}\n`)

  const startTime = Date.now()
  const result: Record<string, string[]> = {}
  const failed: string[] = []
  let successCount = 0

  for (const toolName of toolNames) {
    const variants = ptBR[toolName]
    if (!variants) continue

    process.stdout.write(`  Traduzindo ${toolName}...`)

    const translated = await translateTool(toolName, variants)

    if (translated) {
      result[toolName] = translated
      successCount++
      console.log(` ✓ ${toolName} (${translated.length} variantes)`)
    } else {
      // Fallback: usa entrada pt-BR
      result[toolName] = variants
      failed.push(toolName)
      console.log(` ✗ FAILED: ${toolName} (usando pt-BR como fallback)`)
    }
  }

  // Escreve o arquivo
  writeFileSync(DEST_FILE, JSON.stringify(result, null, 2) + "\n", "utf-8")

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Resumo
  console.log(`\n${"─".repeat(50)}`)
  console.log(`Locale: ${locale}`)
  console.log(`Arquivo: ${DEST_FILE}`)
  console.log(`Tempo: ${elapsed}s`)
  console.log(`Sucesso: ${successCount}/${toolNames.length}`)
  console.log(`Falhas: ${failed.length}`)

  if (failed.length > 0) {
    console.log(`\nEntradas com fallback pt-BR (revisar manualmente):`)
    for (const name of failed) {
      console.log(`  - ${name}`)
    }
  } else {
    console.log(`\nTodas as tools traduzidas com sucesso.`)
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err)
  process.exit(1)
})
