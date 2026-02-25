import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const screenshotsDir = path.resolve(__dirname, '../../../data/screenshots')

export type FetchOgImageResult =
  | { screenshotUrl: string; reason: null }
  | { screenshotUrl: null; reason: 'no_og_image' | 'fetch_failed' | 'image_download_failed' }

export async function fetchOgImage(targetUrl: string): Promise<FetchOgImageResult> {
  // 1. Fetch target page HTML
  let html: string
  try {
    const res = await fetch(targetUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; my-toolbox-bookmarks/1.0)' },
    })
    if (!res.ok) return { screenshotUrl: null, reason: 'fetch_failed' }
    html = await res.text()
  } catch {
    return { screenshotUrl: null, reason: 'fetch_failed' }
  }

  // 2. Extract og:image URL from HTML
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)

  if (!ogMatch) return { screenshotUrl: null, reason: 'no_og_image' }

  let imageUrl = ogMatch[1]
  // Resolve relative URLs
  if (imageUrl.startsWith('//')) {
    imageUrl = 'https:' + imageUrl
  } else if (imageUrl.startsWith('/')) {
    const base = new URL(targetUrl)
    imageUrl = `${base.protocol}//${base.host}${imageUrl}`
  }

  // 3. Download the image locally
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
    if (!imgRes.ok) return { screenshotUrl: null, reason: 'image_download_failed' }

    const contentType = imgRes.headers.get('content-type') ?? ''
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : 'jpg'

    const filename = `${randomUUID()}.${ext}`
    fs.mkdirSync(screenshotsDir, { recursive: true })
    const filePath = path.join(screenshotsDir, filename)

    const buffer = Buffer.from(await imgRes.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    return { screenshotUrl: `/screenshots/${filename}`, reason: null }
  } catch {
    return { screenshotUrl: null, reason: 'image_download_failed' }
  }
}
