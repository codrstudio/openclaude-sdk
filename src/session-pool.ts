// ---------------------------------------------------------------------------
// session-pool.ts — Pool de PersistentSession pre-aquecidas
//
// Uso tipico:
//
//   const pool = createSessionPool({ size: 2, cwd: "d:/nic" })
//   pool.start()
//   const session = await pool.acquire()  // pega uma quente; refila em bg
//   for await (const msg of session.send("oi")) { ... }
//   await session.close()
//
// Combinado com persistent mode, a primeira mensagem de um chat novo paga
// ~zero cold start (sessao ja foi spawnada antes); turnos seguintes pagam
// apenas a latencia do modelo.
//
// ---------------------------------------------------------------------------

import {
  createPersistentSession,
  type PersistentSession,
  type CreatePersistentSessionOptions,
} from "./session-persistent.js"

export interface SessionPoolOptions extends CreatePersistentSessionOptions {
  /** Quantas sessoes idle manter sempre prontas. Default: 2. */
  size?: number
  /** Tempo (ms) maximo de vida de uma sessao idle antes de reciclar. 0 = sem limite. Default: 0. */
  maxIdleAgeMs?: number
  /** Logger opcional pra eventos do pool. */
  log?: (msg: string) => void
}

export interface SessionPool {
  /** Inicia o pool — spawna `size` sessoes em background. */
  start(): void
  /** Pega uma sessao quente (preferencia: ready > warming). Spawna fresh se vazio. Refila em background. */
  acquire(): PersistentSession
  /** Spawna uma sessao via --resume <id> (NAO usa pool). */
  acquireResume(sessionId: string): PersistentSession
  /** Spawna uma sessao fresca SEM usar pool (paga cold start integral). */
  acquireFresh(): PersistentSession
  /** Status atual do pool — util pra dashboards. */
  status(): {
    size: number
    idle: Array<{ sessionId: string; state: PersistentSession["state"]; ageMs: number }>
  }
  /** Mata todas as sessoes idle e marca o pool como fechado. */
  shutdown(): Promise<void>
}

export function createSessionPool(opts: SessionPoolOptions = {}): SessionPool {
  const { size = 2, maxIdleAgeMs = 0, log = () => undefined, ...sessionOpts } = opts
  const idle: PersistentSession[] = []
  let closed = false

  function spawnOne(): void {
    if (closed) return
    try {
      const s = createPersistentSession(sessionOpts)
      idle.push(s)
      log(`[pool] spawn ${s.sessionId.slice(0, 8)} (idle=${idle.length}/${size})`)
    } catch (err) {
      log(`[pool] spawn failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function reapStaleIfNeeded(): void {
    if (maxIdleAgeMs <= 0) return
    const now = Date.now()
    for (let i = idle.length - 1; i >= 0; i--) {
      const s = idle[i]!
      if (now - s.spawnedAtMs > maxIdleAgeMs) {
        log(`[pool] reap ${s.sessionId.slice(0, 8)} age=${now - s.spawnedAtMs}ms`)
        void s.close()
        idle.splice(i, 1)
        spawnOne()
      }
    }
  }

  return {
    start() {
      if (closed) return
      for (let i = 0; i < size; i++) spawnOne()
    },

    acquire(): PersistentSession {
      reapStaleIfNeeded()
      const pickIdx = idle.findIndex((s) => s.state === "ready")
      if (pickIdx !== -1) {
        const s = idle[pickIdx]!
        idle.splice(pickIdx, 1)
        log(`[pool] acquire ${s.sessionId.slice(0, 8)} (idle=${idle.length})`)
        spawnOne()
        return s
      }
      // Sem ready — pega qualquer warming, ou spawn ad-hoc.
      if (idle.length > 0) {
        const s = idle.shift()!
        log(`[pool] acquire (warming) ${s.sessionId.slice(0, 8)}`)
        spawnOne()
        return s
      }
      log(`[pool] empty — spawning ad-hoc`)
      const s = createPersistentSession(sessionOpts)
      spawnOne()
      return s
    },

    acquireResume(sessionId: string): PersistentSession {
      log(`[pool] resume ${sessionId.slice(0, 8)}`)
      return createPersistentSession({ ...sessionOpts, resume: sessionId })
    },

    acquireFresh(): PersistentSession {
      log(`[pool] fresh (bypass pool)`)
      return createPersistentSession(sessionOpts)
    },

    status() {
      return {
        size,
        idle: idle.map((s) => ({
          sessionId: s.sessionId,
          state: s.state,
          ageMs: Date.now() - s.spawnedAtMs,
        })),
      }
    },

    async shutdown() {
      closed = true
      const tasks: Promise<unknown>[] = []
      for (const s of idle) tasks.push(s.close().catch(() => undefined))
      idle.length = 0
      await Promise.all(tasks)
    },
  }
}
