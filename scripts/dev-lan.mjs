/**
 * LAN dev mode (issue #11): starts the dev server reachable from phones on
 * the local network, with NEXTAUTH_URL pointed at this machine's LAN IP so
 * NextAuth cookies and redirects work from other devices.
 *
 *   pnpm dev:lan
 *
 * Note: Google/GitHub OAuth only work on redirect hosts registered with the
 * provider — on LAN, use the demo credentials.
 */
import { networkInterfaces } from "node:os"
import { spawn } from "node:child_process"

const PORT = 6014

function lanIp() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address
    }
  }
  return null
}

const ip = lanIp()
if (!ip) {
  console.error("No LAN IPv4 address found — are you connected to a network?")
  process.exit(1)
}

const url = `http://${ip}:${PORT}`
console.log(`\n  Glidepath LAN dev mode`)
console.log(`  On this machine : http://localhost:${PORT}`)
console.log(`  On your phone   : ${url}`)
console.log(`  NEXTAUTH_URL    : ${url}  (overrides .env for this run)`)
console.log(`  Note: use the demo credentials on LAN — Google OAuth only works on registered hosts.\n`)

const child = spawn("next", ["dev", "-H", "0.0.0.0", "-p", String(PORT)], {
  stdio: "inherit",
  env: { ...process.env, NEXTAUTH_URL: url },
})
child.on("exit", (code) => process.exit(code ?? 0))
