import Fastify from 'fastify'
import { downloadRoutes } from './routes/download.js'

// Trusted reverse-proxy address(es) whose X-Forwarded-* headers we honor for req.protocol/
// req.hostname — comma-separated IPs/CIDRs. Defaults to loopback, matching docker-compose's
// 127.0.0.1:8787 bind: only a reverse proxy running on this host can reach this port at all.
// Set to the proxy's real address if it runs elsewhere (e.g. its container's address on a
// shared Docker network). Never trustProxy: true — that would honor forwarded headers from
// any client, letting a request spoof its own protocol/host.
const trustedProxy = process.env.TRUSTED_PROXY?.split(',').map((s) => s.trim()).filter(Boolean)
const app = Fastify({ logger: true, trustProxy: trustedProxy?.length ? trustedProxy : '127.0.0.1' })

app.get('/healthz', async () => ({ ok: true }))

app.setErrorHandler((error, request, reply) => {
  request.log.error(error)
  // Never forward the upstream error's message/stack to the client — it can carry
  // GitHub API response details that aren't ours to expose.
  reply.code(502).send({ error: 'Upstream error' })
})

await app.register(downloadRoutes)

const port = Number(process.env.PORT ?? 8787)
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
