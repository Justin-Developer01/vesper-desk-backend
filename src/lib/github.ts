const RELEASES_API = 'https://api.github.com/repos/Justin-Developer01/vesper-desk/releases'

type GitHubReleaseAsset = {
  id: number
  name: string
}

type GitHubRelease = {
  tag_name: string
  draft: boolean
  assets: GitHubReleaseAsset[]
}

type AuthedFetchInit = RequestInit & { redirect?: 'manual' | 'follow' | 'error' }

function githubHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = process.env.GITHUB_TOKEN
  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

/**
 * The newest release with a Setup asset attached, walking newest-first so a
 * release whose build is still uploading assets doesn't block on itself —
 * same logic as vesper-desk-web's fetchLatestRelease.
 */
export async function findLatestSetupAsset(): Promise<{ version: string; assetId: number; assetName: string } | null> {
  const res = await fetch(RELEASES_API, { headers: githubHeaders() })
  if (!res.ok) throw new Error(`GitHub releases list failed: ${res.status}`)

  const releases = (await res.json()) as GitHubRelease[]
  for (const release of releases) {
    if (release.draft) continue
    const asset = release.assets.find((a) => /Setup.*\.exe$/i.test(a.name))
    if (!asset) continue
    return { version: release.tag_name, assetId: asset.id, assetName: asset.name }
  }
  return null
}

/**
 * Resolves a release asset to GitHub's short-lived signed download URL,
 * without downloading the (tens-of-MB) asset itself through this server.
 * GitHub's asset API 302s to that URL when asked for the raw content type.
 */
export async function resolveAssetDownloadUrl(assetId: number): Promise<string> {
  const url = `https://api.github.com/repos/Justin-Developer01/vesper-desk/releases/assets/${assetId}`
  const init: AuthedFetchInit = {
    headers: githubHeaders({ Accept: 'application/octet-stream' }),
    redirect: 'manual',
  }
  const res = await fetch(url, init)

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (location) return location
  }

  throw new Error(`GitHub asset redirect failed: ${res.status}`)
}
