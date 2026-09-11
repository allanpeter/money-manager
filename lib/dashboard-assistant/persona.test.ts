import assert from "node:assert/strict"
import test from "node:test"
import { localDateId } from "./persona"

test("gera data local no fuso configurado", () => {
  assert.match(localDateId("America/Sao_Paulo"), /^\d{4}-\d{2}-\d{2}$/)
})
