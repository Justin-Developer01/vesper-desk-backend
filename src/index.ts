import Fastify from 'fastify'
import { downloadRoutes } from './routes/download.js'

const app = Fastify({ logger: true })

app.get('/healthz', async () => ({ ok: true }))

await app.register(downloadRoutes)

const port = Number(process.env.PORT ?? 8787)
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
