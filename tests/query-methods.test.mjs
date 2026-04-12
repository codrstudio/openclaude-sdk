import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

async function makeFixture(scriptSource) {
  const dir = await mkdtemp(join(tmpdir(), 'openclaude-sdk-query-'))
  const scriptPath = join(dir, 'fake-openclaude.mjs')
  await writeFile(scriptPath, `#!/usr/bin/env node\n${scriptSource}`)
  await chmod(scriptPath, 0o755)
  return { dir, scriptPath }
}

async function importProcessModule() {
  const source = await readFile(new URL('../src/process.ts', import.meta.url), 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'process.ts',
  })
  const dir = await mkdtemp(join(tmpdir(), 'openclaude-sdk-process-'))
  const modulePath = join(dir, 'process.mjs')
  await writeFile(modulePath, transpiled.outputText)
  return import(`file://${modulePath}`)
}

test('initialization-derived methods read from one cached init result', async () => {
  const { scriptPath } = await makeFixture(`
    process.stdin.resume()
    console.log(JSON.stringify({
      type: 'system',
      subtype: 'init',
      session_id: 's1',
      commands: [{ name: '/help', description: 'help' }],
      agents: [{ name: 'worker', description: 'Worker agent', model: 'x' }],
      output_style: 'default',
      available_output_styles: ['default'],
      models: [{ id: 'model-a', name: 'Model A', provider: 'openai' }],
      account: { email: 'dev@example.com' }
    }))
    console.log(JSON.stringify({ type: 'result', subtype: 'success', session_id: 's1', result: 'ok' }))
  `)

  const { query } = await import('../dist/index.js')
  const q = query({
    prompt: 'hello',
    options: { pathToClaudeCodeExecutable: scriptPath },
  })

  try {
    assert.equal(typeof q.initializationResult, 'function')
    const commands = await q.supportedCommands()
    const models = await q.supportedModels()
    const agents = await q.supportedAgents()
    const account = await q.accountInfo()
    const init = await q.initializationResult()

    assert.equal(commands[0]?.name, '/help')
    assert.equal(models[0]?.id, 'model-a')
    assert.equal(agents[0]?.name, 'worker')
    assert.equal(account.email, 'dev@example.com')
    assert.equal(init.commands[0]?.name, '/help')
    assert.equal(init.models[0]?.id, 'model-a')
    assert.equal(init.agents[0]?.name, 'worker')
    assert.equal(init.account.email, 'dev@example.com')
    assert.equal(typeof q.mcpServerStatus, 'undefined')
  } finally {
    q.close()
  }
})

test('spawnAndStream routes control responses away from the SDK message stream', async () => {
  const { scriptPath } = await makeFixture(`
    import readline from 'node:readline'

    console.log(JSON.stringify({
      type: 'system',
      subtype: 'init',
      session_id: 's1',
      commands: [],
      agents: [],
      output_style: 'default',
      available_output_styles: ['default'],
      models: [],
      account: {}
    }))

    const rl = readline.createInterface({ input: process.stdin })
    rl.on('line', line => {
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        return
      }

      if (msg.type === 'control_request' && msg.subtype === 'mcp_status') {
        console.log(JSON.stringify({
          type: 'control_response',
          response: {
            subtype: 'mcp_status',
            request_id: msg.request_id,
            response: {
              mcpServers: [{ name: 'demo', status: 'connected', tools: [{ name: 'read' }] }]
            }
          }
        }))
        console.log(JSON.stringify({ type: 'result', subtype: 'success', session_id: 's1', result: 'done' }))
        rl.close()
        setTimeout(() => process.exit(0), 0)
      }
    })
  `)

  const { spawnAndStream } = await importProcessModule()
  const { stream, controlResponses, writeStdin, close } = spawnAndStream(
    process.execPath,
    [scriptPath],
    'hello',
  )

  try {
    const seen = []
    const controlTask = (async () => {
      for await (const msg of controlResponses) {
        return msg
      }
      return null
    })()

    writeStdin(JSON.stringify({
      type: 'control_request',
      subtype: 'mcp_status',
      request_id: 'req-1',
    }) + '\n')

    for await (const msg of stream) {
      seen.push(msg.type)
    }

    const control = await controlTask
    assert.equal(control?.type, 'control_response')
    assert.equal(control?.response?.subtype, 'mcp_status')
    assert.equal(control?.response?.request_id, 'req-1')
    assert.equal(control?.response?.response?.mcpServers?.[0]?.name, 'demo')
    assert.deepEqual(seen, ['system', 'result'])
  } finally {
    close()
  }
})
