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

  // Metadata only — no redirect, so callers can show version/size info
  // without resolving (and risking baking in) GitHub's short-lived signed
  // asset URL. The asset `url` here is this server's own stable redirect
  // endpoint above, which always resolves fresh at click time.
  app.get('/v1/download/latest/info', async (req, reply) => {
    const latest = await findLatestSetupAsset()
    if (!latest) {
      return reply.code(404).send({ error: 'No installer release available yet' })
    }

    const origin = `${req.protocol}://${req.hostname}`
    return reply.send({
      version: latest.version,
      publishedAt: latest.publishedAt,
      notesUrl: latest.notesUrl,
      assets: [
        {
          platform: 'windows',
          kind: 'installer',
          url: `${origin}/v1/download/latest`,
          sizeBytes: latest.sizeBytes,
        },
      ],
    })
  })
}
