// @vitest-environment node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { registerSpaStatic } from './static'

function makeTempWebDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'work-hours-static-'))
}

describe('registerSpaStatic', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('serves newly generated hashed asset files without requiring a server restart', async () => {
    const webDir = makeTempWebDir()
    tempDirs.push(webDir)

    fs.mkdirSync(path.join(webDir, 'assets'), { recursive: true })
    fs.writeFileSync(path.join(webDir, 'assets', 'old.js'), 'console.log("old")')
    fs.writeFileSync(path.join(webDir, 'index.html'), '<script type="module" src="/assets/old.js"></script>')

    const app = Fastify()
    await registerSpaStatic(app, webDir)

    fs.rmSync(path.join(webDir, 'assets', 'old.js'))
    fs.writeFileSync(path.join(webDir, 'assets', 'new.js'), 'console.log("new")')
    fs.writeFileSync(path.join(webDir, 'index.html'), '<script type="module" src="/assets/new.js"></script>')

    const res = await app.inject({ method: 'GET', url: '/assets/new.js' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('console.log("new")')

    await app.close()
  })

  it('serves index.html for SPA document routes', async () => {
    const webDir = makeTempWebDir()
    tempDirs.push(webDir)

    fs.writeFileSync(path.join(webDir, 'index.html'), '<!doctype html><div id="root"></div>')

    const app = Fastify()
    await registerSpaStatic(app, webDir)

    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('<div id="root"></div>')

    await app.close()
  })
})
