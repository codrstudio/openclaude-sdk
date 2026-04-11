import { z } from "zod"

export const askUserSchema = z.object({
  question: z.string().describe("The question to ask the user"),
  context: z.string().optional().describe("Optional context explaining why this question is needed"),
  inputType: z.enum(["text", "number", "boolean", "choice"]).default("text")
    .describe("The expected type of the user's answer"),
  choices: z.array(z.object({
    id: z.string(),
    label: z.string(),
  })).optional().describe("Required when inputType is 'choice'"),
  placeholder: z.string().optional().describe("Optional placeholder text for the input"),
})

export type AskUserInput = z.infer<typeof askUserSchema>
