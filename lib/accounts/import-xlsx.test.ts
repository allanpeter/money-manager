import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { parseOfficialWorkbook } from "./import-xlsx"

test("parser lê a aba Oficial e sinaliza o valor composto", async () => {
  const parsed = await parseOfficialWorkbook(await readFile("Contas 2021.xlsx"), 2021)
  assert.ok(parsed.accounts.some(account => account.name === "Cartão NuBank"))
  assert.ok(parsed.issues.some(issue => issue.rawValue === "107+87,49"))
  assert.ok(parsed.accounts.every(account => account.occurrences.length > 0))
})
