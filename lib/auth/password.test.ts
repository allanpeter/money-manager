import assert from "node:assert/strict"
import test from "node:test"
import { hashPassword, validPassword, verifyPassword } from "./password"

test("hash de senha usa salt e valida sem armazenar texto puro", async () => {
  const password = "Senha-forte-123!"
  const first = await hashPassword(password)
  const second = await hashPassword(password)
  assert.notEqual(first, second)
  assert.equal(first.includes(password), false)
  assert.equal(await verifyPassword(password, first), true)
  assert.equal(await verifyPassword("senha-incorreta", first), false)
})

test("senha de cadastro exige comprimento, letra, número e símbolo", () => {
  assert.equal(validPassword("Senha-forte-123!"), true)
  assert.equal(validPassword("senhafraca"), false)
})
