/**
 * Shape do `input` de um `tool_use` block filtrado pelo SDK no modo `"intention"`.
 *
 * Todos os campos têm prefixo `_` (underline leading) como convenção de metadado
 * do SDK — distingue o payload sintético do `input` original do modelo.
 */
export interface ToolIntentionPayload {
  /** Frase de intenção no locale ativo (ex: "Executando um comando") */
  _intention: string

  /** Nome original da tool conforme emitida pelo modelo (ex: "Bash") */
  _toolName: string

  /** ID do bloco `tool_use` correspondente (ex: "toolu_01abc") */
  _toolUseId: string

  /** Marcador de que o `input` original foi substituído por este payload */
  _filtered: true
}
