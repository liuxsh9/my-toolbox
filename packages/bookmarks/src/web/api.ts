export interface Bookmark {
  id: string
  title: string
  url: string
  category: string | null
  screenshot: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export async function fetchBookmarks(category?: string): Promise<Bookmark[]> {
  const url = category ? `/api/bookmarks?category=${encodeURIComponent(category)}` : '/api/bookmarks'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch bookmarks')
  return res.json()
}

export async function fetchCategories(): Promise<string[]> {
  const res = await fetch('/api/bookmarks/categories')
  if (!res.ok) throw new Error('Failed to fetch categories')
  return res.json()
}

export async function createBookmark(data: { title: string; url: string; category?: string }): Promise<Bookmark> {
  const res = await fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create bookmark')
  return res.json()
}

export async function updateBookmark(id: string, data: Partial<Bookmark>): Promise<Bookmark> {
  const res = await fetch(`/api/bookmarks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update bookmark')
  return res.json()
}

export async function deleteBookmark(id: string): Promise<void> {
  const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete bookmark')
}

export async function fetchScreenshot(id: string, url: string): Promise<{ screenshotUrl: string | null; reason?: string }> {
  const res = await fetch(`/api/bookmarks/${id}/fetch-screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error('Failed to fetch screenshot')
  return res.json()
}

export async function uploadScreenshot(id: string, file: File | Blob): Promise<{ screenshotUrl: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/bookmarks/${id}/upload-screenshot`, { method: 'POST', body: form })
  if (!res.ok) throw new Error('Failed to upload screenshot')
  return res.json()
}
