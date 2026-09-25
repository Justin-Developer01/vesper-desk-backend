const RELEASES_API = 'https://api.github.com/repos/Justin-Developer01/vesper-desk/releases'
const FETCH_TIMEOUT_MS = 5_000
const CACHE_TTL_MS = 5 * 60_000

// GitHub's own asset-redirect hosts. resolveAssetDownloadUrl only ever hands back a
// Location on one of these, so a visitor can never be redirected anywhere else.
const ALLOWED_REDIRECT_HOSTS = [/(^|\.)githubusercontent\.com$/i]

type GitHubReleaseAsset = {
  id: number
  name: string
  size: number
}

type GitHubRelease = {
  tag_name: string
  html_url: string
  published_at: string
  draft: boolean
  assets: GitHubReleaseAsset[]
}

export type LatestSetupAsset = {
  version: string
  assetId: number
  assetName: string
  sizeBytes: number
  publishedAt: string
  notesUrl: string
}

type AuthedFetchInit = RequestInit & { redirect?: 'manual' | 'follow' | 'error' }

function githubHeaders(extra?: Record<string, string>): Record<string, string> {
  // Prefer GITHUB_TOKEN whenever it's set, not only once vesper-desk goes private: an
  // authenticated request gets 5,000 requests/hour instead of 60 shared across every visitor.
  const token = process.env.GITHUB_TOKEN
  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

let cached: { at: number; value: LatestSetupAsset | null } | null = null
let inFlight: Promise<LatestSetupAsset | null> | null = null

/**
 * The newest release with a Setup asset attached, walking newest-first so a
 * release whose build is still uploading assets doesn't block on itself —
 * same logic as vesper-desk-web's fetchLatestRelease.
 *
 * Cached for CACHE_TTL_MS, and concurrent callers during a cache miss share one in-flight
 * GitHub request instead of each firing their own — a traffic spike (or every visitor hitting
 * a cold cache at once) still costs at most one call to GitHub every 5 minutes. A failed
 * lookup is never cached, so the next call retries against GitHub rather than being stuck
 * returning the same error for the rest of the TTL.
 */
export async function findLatestSetupAsset(): Promise<LatestSetupAsset | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
  if (!inFlight) {
    inFlight = fetchLatestSetupAsset()
      .then((value) => {
        cached = { at: Date.now(), value }
        return value
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

async function fetchLatestSetupAsset(): Promise<LatestSetupAsset | null> {
  const res = await fetch(RELEASES_API, { headers: githubHeaders(), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`GitHub releases list failed: ${res.status}`)

  const releases = (await res.json()) as GitHubRelease[]
  for (const release of releases) {
    if (release.draft) continue
    const asset = release.assets.find((a) => /Setup.*\.exe$/i.test(a.name))
    if (!asset) continue
    return {
      version: release.tag_name,
      assetId: asset.id,
      assetName: asset.name,
      sizeBytes: asset.size,
      publishedAt: release.published_at,
      notesUrl: release.html_url,
    }
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
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }
  const res = await fetch(url, init)

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (location && isAllowedRedirectHost(location)) return location
    throw new Error(location ? `GitHub asset redirect host not allowed: ${location}` : 'GitHub asset redirect had no Location header')
  }

  throw new Error(`GitHub asset redirect failed: ${res.status}`)
}

function isAllowedRedirectHost(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return ALLOWED_REDIRECT_HOSTS.some((pattern) => pattern.test(hostname))
  } catch {
    return false
  }
}
