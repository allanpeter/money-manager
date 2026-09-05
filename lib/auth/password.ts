import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"

const KEY_LENGTH = 64
const COST = 16_384

function derive(password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) => scrypt(password, salt, length, options, (error, key) => error ? reject(error) : resolve(key)))
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, KEY_LENGTH, { N: COST, r: 8, p: 1 })
  return `scrypt$${COST}$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, cost, r, p, saltValue, keyValue] = encoded.split("$")
  if (algorithm !== "scrypt" || !cost || !r || !p || !saltValue || !keyValue) return false
  const expected = Buffer.from(keyValue, "base64url")
  const key = await derive(password, Buffer.from(saltValue, "base64url"), expected.length, {
    N: Number(cost), r: Number(r), p: Number(p),
  })
  return expected.length === key.length && timingSafeEqual(expected, key)
}

export function validPassword(password: string) {
  return password.length >= 12 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)
}
