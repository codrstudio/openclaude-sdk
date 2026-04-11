export interface AskUserRequest {
  callId: string
  question: string
  context?: string
  inputType: "text" | "number" | "boolean" | "choice"
  choices?: { id: string; label: string }[]
  placeholder?: string
}

export type AskUserAnswer =
  | { type: "text"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "choice"; id: string }
  | { type: "cancelled" }
