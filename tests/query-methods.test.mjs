import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function makeFixture(scriptSource) {
  const dir = await mkdtemp(join(tmpdir(), 'openclaude-sdk-query-'))
  const scriptPath = join(dir, 'fake-openclaude.mjs')
  await writeFile(scriptPath, scriptSource)
  return { dir, scriptPath }
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
    options: { pathToClaudeCodeExecutable: process.execPath, extraArgs: { import: scriptPath } },
  })

  try {
    const commands = await q.supportedCommands()
    const models = await q.supportedModels()
    const agents = await q.supportedAgents()
    const account = await q.accountInfo()

    assert.equal(commands[0]?.name, '/help')
    assert.equal(models[0]?.id, 'model-a')
    assert.equal(agents[0]?.name, 'worker')
    assert.equal(account.email, 'dev@example.com')
  } finally {
    q.close()
  }
})
