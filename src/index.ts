import Fastify from 'fastify'
import { downloadRoutes } from './routes/download.js'

// trustProxy: reverse-proxied behind Caddy, which terminates TLS and sets
// X-Forwarded-Proto — without this, req.protocol/req.hostname would report
// the plain-HTTP connection Caddy makes to this server, not the real
// https:// request a visitor made.
const app = Fastify({ logger: true, trustProxy: true })

app.get('/healthz', async () => ({ ok: true }))

await app.register(downloadRoutes)

const port = Number(process.env.PORT ?? 8787)
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
