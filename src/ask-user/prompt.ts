export const ASK_USER_SYSTEM_PROMPT = `You can ask the user for information mid-task using the ask_user tool. Use it when:
- You need clarification on an ambiguous request
- A required piece of information is missing
- You want explicit confirmation before an expensive or irreversible action

Prefer ask_user over guessing. Keep questions concise and provide context when needed.
Use inputType='choice' when there are clear discrete options.
Use inputType='boolean' for yes/no confirmations.
Use inputType='number' when expecting a numeric value.`
