// ---------------------------------------------------------------------------
// session-pool.ts — Pool de PersistentSession pre-aquecidas
//
// Uso tipico:
//
//   const pool = createSessionPool({ size: 2, cwd: "d:/nic" })
//   await pool.start()
//   const session = pool.acquire()      // pega uma quente; refila em background
//   for await (const msg of session.send("oi")) { ... }
//   await session.close()
//
// Combinado com persistent mode, a primeira mensagem de um chat novo paga
// ~zero cold start (sessao ja foi spawnada antes); turnos seguintes pagam
// apenas a latencia do modelo.
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
    const s = createPersistentSession(sessionOpts)
    log(`[pool] spawn ${s.sessionId.slice(0, 8)} (idle=${idle.length + 1}/${size})`)
    idle.push(s)
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
      // Prefere ready; aceita warming se for o que tem.
      let pick = idle.find((s) => s.state === "ready")
      if (!pick) pick = idle.find((s) => s.state === "warming")
      if (pick) {
        const i = idle.indexOf(pick)
        idle.splice(i, 1)
        log(`[pool] acquire ${pick.sessionId.slice(0, 8)} (was ${pick.state}, idle=${idle.length})`)
        spawnOne()
        return pick
      }
      // Pool vazio — spawn ad-hoc e tambem refila.
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
      const tasks = idle.map((s) => s.close().catch(() => undefined))
      idle.length = 0
      await Promise.all(tasks)
    },
  }
}
