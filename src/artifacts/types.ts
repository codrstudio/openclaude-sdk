// Tipos públicos do recurso Artifacts.
//
// O wire entre SDK e chat é o próprio TextBlock — o agente emite tags
// `<antArtifact>` no texto, e o chat parseia. SDK não vê os artifacts;
// só ensina o agente via skill body.

export type ArtifactType =
  | "application/vnd.ant.code"
  | "text/markdown"
  | "text/html"
  | "image/svg+xml"
  | "application/vnd.ant.mermaid"
  | "application/vnd.ant.react"

export interface ArtifactsFeatures {
  /** Versão do contrato (cliente declara qual ele suporta). Default: 1. */
  compat?: number
  /** Lista de types que o cliente sabe renderizar. Se ausente, todos os 6. */
  enabledTypes?: ArtifactType[]
}
