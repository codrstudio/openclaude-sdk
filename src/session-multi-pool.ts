// ---------------------------------------------------------------------------
// session-multi-pool.ts — Pool segmentado por cwd (multi-agente)
//
// Cada `cwd` mantem seu proprio sub-pool de PersistentSession pre-aquecidas.
// Util quando voce serve N agentes (cwds distintos) na mesma instancia.
//
//   const pool = createMultiSessionPool({ sizePerCwd: 2, baseOptions: {...} })
//   const a = pool.acquire({ cwd: "d:/nic" })       // aquece sub-pool de Nic
//   const b = pool.acquire({ cwd: "d:/aurora" })    // aquece sub-pool de Aurora
//
// Internalmente delega pra createSessionPool por cwd. Sem cap global de procs;
// se precisar de teto, faca controle no consumer ou use uma versao futura.
// ---------------------------------------------------------------------------

import { createSessionPool, type SessionPool } from "./session-pool.js"
import type {
  PersistentSession,
  CreatePersistentSessionOptions,
} from "./session-persistent.js"

/** Opcoes herdadas por cada sub-pool (sem cwd, que vem no acquire). */
export type MultiPoolBaseOptions = Omit<
  CreatePersistentSessionOptions,
  "cwd" | "sessionId" | "resume"
>

export interface MultiSessionPoolOptions {
  /** Sessoes idle por cwd. Default: 2. */
  sizePerCwd?: number
  /** Opcoes base aplicadas a todas as sessoes (cwd vem no acquire). */
  baseOptions?: MultiPoolBaseOptions
  /** Tempo (ms) maximo de vida de uma sessao idle antes de reciclar. 0 = sem limite. Default: 0. */
  maxIdleAgeMs?: number
  /** Logger opcional. */
  log?: (msg: string) => void
}

export interface MultiSessionPool {
  /** Pre-aquece o sub-pool deste cwd (idempotente). */
  warm(cwd: string): void
  /** Pega uma sessao quente do cwd. Cria sub-pool sob demanda. */
  acquire(opts: { cwd: string }): PersistentSession
  /** Spawna ad-hoc com --resume <id> no cwd dado (NAO usa pool). */
  acquireResume(opts: { cwd: string; sessionId: string }): PersistentSession
  /** Spawna ad-hoc fresh no cwd dado (NAO usa pool, paga cold start). */
  acquireFresh(opts: { cwd: string }): PersistentSession
  /** Status agregado por cwd. */
  status(): {
    sizePerCwd: number
    perCwd: Record<
      string,
      {
        idle: Array<{ sessionId: string; state: PersistentSession["state"]; ageMs: number }>
      }
    >
    total: number
  }
  /** Fecha todos os sub-pools. */
  shutdown(): Promise<void>
}

export function createMultiSessionPool(
  opts: MultiSessionPoolOptions = {},
): MultiSessionPool {
  const {
    sizePerCwd = 2,
    baseOptions = {},
    maxIdleAgeMs = 0,
    log = () => undefined,
  } = opts

  const subPools = new Map<string, SessionPool>()
  let closed = false

  function getOrCreate(cwd: string): SessionPool {
    let sub = subPools.get(cwd)
    if (sub) return sub
    log(`[multi-pool] create sub-pool cwd=${cwd}`)
    sub = createSessionPool({
      ...baseOptions,
      cwd,
      size: sizePerCwd,
      maxIdleAgeMs,
      log: (m) => log(`[cwd=${cwd}] ${m}`),
    })
    sub.start()
    subPools.set(cwd, sub)
    return sub
  }

  return {
    warm(cwd: string) {
      if (closed) return
      getOrCreate(cwd)
    },

    acquire({ cwd }) {
      if (closed) throw new Error("multi-pool: closed")
      return getOrCreate(cwd).acquire()
    },

    acquireResume({ cwd, sessionId }) {
      if (closed) throw new Error("multi-pool: closed")
      return getOrCreate(cwd).acquireResume(sessionId)
    },

    acquireFresh({ cwd }) {
      if (closed) throw new Error("multi-pool: closed")
      return getOrCreate(cwd).acquireFresh()
    },

    status() {
      const perCwd: Record<
        string,
        { idle: Array<{ sessionId: string; state: PersistentSession["state"]; ageMs: number }> }
      > = {}
      let total = 0
      for (const [cwd, sub] of subPools) {
        const s = sub.status()
        perCwd[cwd] = { idle: s.idle }
        total += s.idle.length
      }
      return { sizePerCwd, perCwd, total }
    },

    async shutdown() {
      closed = true
      const tasks: Promise<void>[] = []
      for (const sub of subPools.values()) tasks.push(sub.shutdown())
      subPools.clear()
      await Promise.all(tasks)
    },
  }
}
