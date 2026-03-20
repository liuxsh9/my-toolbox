import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { registerSpaStatic } from './spa-static'

function makeTempWebDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'shared-spa-static-'))
}

describe('registerSpaStatic', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('serves index.html for root and document routes', async () => {
    const webDir = makeTempWebDir()
    tempDirs.push(webDir)
    fs.writeFileSync(path.join(webDir, 'index.html'), '<!doctype html><div id="root"></div>')

    const app = Fastify()
    await registerSpaStatic(app, webDir)

    const rootRes = await app.inject({ method: 'GET', url: '/' })
    const deepRes = await app.inject({ method: 'GET', url: '/dashboard' })

    expect(rootRes.statusCode).toBe(200)
    expect(rootRes.body).toContain('<div id="root"></div>')
    expect(deepRes.statusCode).toBe(200)
    expect(deepRes.body).toContain('<div id="root"></div>')

    await app.close()
  })

  it('returns 404 for api and extension routes', async () => {
    const webDir = makeTempWebDir()
    tempDirs.push(webDir)
    fs.writeFileSync(path.join(webDir, 'index.html'), '<!doctype html><div id="root"></div>')

    const app = Fastify()
    await registerSpaStatic(app, webDir)

    const apiRes = await app.inject({ method: 'GET', url: '/api/missing' })
    const iconRes = await app.inject({ method: 'GET', url: '/favicon.ico' })

    expect(apiRes.statusCode).toBe(404)
    expect(iconRes.statusCode).toBe(404)

    await app.close()
  })

  it('serves newly generated hashed assets without requiring re-registration', async () => {
    const webDir = makeTempWebDir()
    tempDirs.push(webDir)
    const assetsDir = path.join(webDir, 'assets')
    fs.mkdirSync(assetsDir, { recursive: true })
    fs.writeFileSync(path.join(webDir, 'index.html'), '<script type="module" src="/assets/old.js"></script>')
    fs.writeFileSync(path.join(assetsDir, 'old.js'), 'console.log("old")')

    const app = Fastify()
    await registerSpaStatic(app, webDir)

    fs.rmSync(path.join(assetsDir, 'old.js'))
    fs.writeFileSync(path.join(assetsDir, 'new.js'), 'console.log("new")')
    fs.writeFileSync(path.join(webDir, 'index.html'), '<script type="module" src="/assets/new.js"></script>')

    const assetRes = await app.inject({ method: 'GET', url: '/assets/new.js' })

    expect(assetRes.statusCode).toBe(200)
    expect(assetRes.body).toContain('console.log("new")')

    await app.close()
  })
})
