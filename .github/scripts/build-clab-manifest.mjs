import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const root = resolve(process.argv[2] || '.vitepress/dist-site')
const revision = process.env.GITHUB_SHA
const manifestName = '_clab-sync.json'
if (!/^[a-f0-9]{40}$/.test(revision ?? '')) {
  throw new Error('GITHUB_SHA must identify the published commit')
}

async function listFiles(directory, prefix = '') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name
    const path = join(directory, entry.name)
    if (name === manifestName) continue
    if (entry.isDirectory()) {
      files.push(...await listFiles(path, name + '/'))
    } else if (entry.isFile()) {
      const data = await readFile(path)
      files.push({ path: name, size: data.length, sha256: createHash('sha256').update(data).digest('hex') })
    } else {
      throw new Error('Unsupported build output entry ' + name)
    }
  }
  return files
}

const files = await listFiles(root)
files.sort((left, right) => left.path === right.path ? 0 : left.path < right.path ? -1 : 1)
const indexedPaths = new Set(files.map(file => file.path))
if (!indexedPaths.has('index.html') || !files.some(file => file.path.endsWith('.mp4'))) {
  throw new Error('The build did not contain both the site and its videos')
}
await writeFile(join(root, manifestName), JSON.stringify({
  version: 1,
  revision,
  generatedAt: new Date().toISOString(),
  files,
}) + '\n')
