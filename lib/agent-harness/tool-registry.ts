import type { ToolDefinition, ToolExecution, ToolRegistry } from "./contracts"

const echoDefinition: ToolDefinition = {
  name: "echo",
  description: "Devolve exatamente o valor recebido. Ferramenta exclusiva de demonstração.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: { value: {} },
    required: ["value"],
  },
}

/** Example registry only. It has no connection to the financial application. */
export class ExampleToolRegistry implements ToolRegistry {
  definitions(): readonly ToolDefinition[] { return [echoDefinition] }

  async execute(name: string, input: unknown): Promise<ToolExecution> {
    if (name !== "echo") return { ok: false, error: { code: "TOOL_NOT_FOUND", message: `Ferramenta desconhecida: ${name}` } }
    if (!input || typeof input !== "object" || !("value" in input)) {
      return { ok: false, error: { code: "INVALID_INPUT", message: "A ferramenta echo exige o campo value." } }
    }
    return { ok: true, output: (input as { value: unknown }).value }
  }
}
