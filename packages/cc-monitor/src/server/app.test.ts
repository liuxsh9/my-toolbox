import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createApp } from './app.ts'

test('serves newly built hashed assets after app startup', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc-monitor-web-'))
  const webDir = path.join(root, 'web')
  const assetsDir = path.join(webDir, 'assets')

  await mkdir(assetsDir, { recursive: true })
  await writeFile(path.join(webDir, 'index.html'), '<!doctype html><script type="module" src="/assets/old.js"></script>')
  await writeFile(path.join(assetsDir, 'old.js'), 'console.log("old")')

  const app = await createApp({ webDir, startProcessScanner: false, logger: false })

  try {
    await writeFile(path.join(webDir, 'index.html'), '<!doctype html><script type="module" src="/assets/new.js"></script>')
    await writeFile(path.join(assetsDir, 'new.js'), 'console.log("new")')

    const assetRes = await app.inject({ method: 'GET', url: '/assets/new.js' })
    assert.equal(assetRes.statusCode, 200)
    assert.match(assetRes.headers['content-type'] || '', /javascript/)
    assert.match(assetRes.body, /console\.log\("new"\)/)

    const indexRes = await app.inject({ method: 'GET', url: '/' })
    assert.equal(indexRes.statusCode, 200)
    assert.match(indexRes.headers['content-type'] || '', /text\/html/)
    assert.match(indexRes.body, /new\.js/)
  } finally {
    await app.close()
    await rm(root, { recursive: true, force: true })
  }
})
