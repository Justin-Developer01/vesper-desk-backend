import type { FastifyInstance } from 'fastify'
import { findLatestSetupAsset, resolveAssetDownloadUrl } from '../lib/github.js'

/** PUBLIC_ORIGIN (e.g. https://api.vesperdesk.app), falling back to the local dev address. */
function publicOrigin(): string {
  const configured = process.env.PUBLIC_ORIGIN?.trim().replace(/\/$/, '')
  if (configured) return configured
  return `http://localhost:${process.env.PORT ?? 8787}`
}

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
  app.get('/v1/download/latest/info', async (_req, reply) => {
    const latest = await findLatestSetupAsset()
    if (!latest) {
      return reply.code(404).send({ error: 'No installer release available yet' })
    }

    // Built from a configured, trusted value — never from the request's protocol/hostname,
    // which (even behind a pinned reverse proxy) can still carry a client-supplied Host header.
    const origin = publicOrigin()
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
