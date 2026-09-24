import type { FastifyInstance } from 'fastify'
import { findLatestSetupAsset, resolveAssetDownloadUrl } from '../lib/github.js'

export async function downloadRoutes(app: FastifyInstance) {
  app.get('/v1/download/latest', async (_req, reply) => {
    const latest = await findLatestSetupAsset()
    if (!latest) {
      return reply.code(404).send({ error: 'No installer release available yet' })
    }

    const downloadUrl = await resolveAssetDownloadUrl(latest.assetId)
    reply.header('X-Vesper-Version', latest.version)
    return reply.redirect(downloadUrl, 302)
  })
}
