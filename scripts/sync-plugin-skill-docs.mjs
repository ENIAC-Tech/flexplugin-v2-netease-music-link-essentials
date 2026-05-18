#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = join(repoRoot, '.agents', 'skills', 'flexstudio-plugin-developer')
const referencesRoot = join(skillRoot, 'references')
const flexdocOutputRoot = join(referencesRoot, 'flexdoc')
const pluginDocsJsonPath = join(repoRoot, '.flexstudio', 'plugin-docs.json')

const DOC_FILE_ORDER = [
  'index.md',
  'overview.md',
  'getting-started.md',
  'project-structure.md',
  'manifest.md',
  'unit-definitions.md',
  'backend-runtime.md',
  'frontend-bridge.md',
  'host-api-reference.md',
  'dependency-api.md',
  'cli-reference.md',
  'marketplace-release.md',
  'troubleshooting.md',
]

const DOC_DESCRIPTIONS = {
  'index.md': 'Entry page for plugin development documentation.',
  'overview.md': 'System architecture, runtime model, lifecycle, permissions, and release overview.',
  'getting-started.md': 'First plugin workflow from scaffold to local dev.',
  'project-structure.md': 'Expected plugin project layout and generated files.',
  'manifest.md': 'Manifest fields, permissions, entries, platforms, devices, and dependencies.',
  'unit-definitions.md': 'Library and Unit definition payloads and validation rules.',
  'backend-runtime.md': 'FlexPluginBase lifecycle, backend RPC, events, and runtime patterns.',
  'frontend-bridge.md': 'Iframe bridge, mountFlexPage, useFlexBridge, and frontend page contracts.',
  'host-api-reference.md': 'Host API permissions and capability reference.',
  'dependency-api.md': 'Plugin dependency declaration and runtime dependency APIs.',
  'cli-reference.md': 'FlexCLI plugin-v2 command reference.',
  'marketplace-release.md': 'GitHub Release and marketplace publishing workflow.',
  'troubleshooting.md': 'Failure symptoms and debugging steps.',
}

function parseArgs(argv) {
  const args = {
    docsRoot: process.env.FLEXSTUDIO_DOCS_ROOT,
    check: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--docs-root') {
      args.docsRoot = argv[++i]
    } else if (arg === '--check') {
      args.check = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!args.docsRoot) {
    args.docsRoot = resolve(repoRoot, '..', 'FlexStudioDocumentation', 'docs', 'zh', 'sdk', 'plugin-development')
  }

  args.docsRoot = resolve(args.docsRoot)
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!existsSync(args.docsRoot)) {
    throw new Error(`FlexStudio plugin docs root not found: ${args.docsRoot}`)
  }

  const generated = await buildGeneratedFiles(args.docsRoot)
  if (args.check) {
    await checkGeneratedFiles(generated)
    console.log('Plugin skill docs are up to date.')
    return
  }

  await writeGeneratedFiles(generated)
  console.log(`Synced ${DOC_FILE_ORDER.length} plugin docs from ${args.docsRoot}`)
}

async function buildGeneratedFiles(docsRoot) {
  const files = new Map()
  const entries = await readdir(docsRoot)
  const missing = DOC_FILE_ORDER.filter((fileName) => !entries.includes(fileName))
  if (missing.length > 0) {
    throw new Error(`Missing plugin docs: ${missing.join(', ')}`)
  }

  for (const fileName of DOC_FILE_ORDER) {
    const sourcePath = join(docsRoot, fileName)
    const raw = await readFile(sourcePath, 'utf8')
    files.set(join(flexdocOutputRoot, fileName), normalizeMarkdown(raw))
  }

  const metadata = {
    sourceRepo: 'FlexStudioDocumentation',
    sourcePath: 'docs/zh/sdk/plugin-development',
    sourceCommit: readGitCommit(docsRoot),
    docsLanguage: 'zh-CN',
    generatedBy: 'scripts/sync-plugin-skill-docs.mjs',
    files: DOC_FILE_ORDER,
  }

  const metadataText = `${JSON.stringify(metadata, null, 2)}\n`
  files.set(join(flexdocOutputRoot, 'metadata.json'), metadataText)
  files.set(join(referencesRoot, 'docs-index.md'), buildDocsIndex(metadata))
  files.set(pluginDocsJsonPath, metadataText)

  return files
}

function normalizeMarkdown(markdown) {
  return markdown
    .replace(/^\uFEFF/, '')
    .replace(/<span class="plugin-diagram">[\s\S]*?<\/span>\n?/g, '')
    .replace(/^!\[[^\]]*\]\([^)]*\/diagrams\/plugin-development\/[^)]*\)\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
    .concat('\n')
}

function buildDocsIndex(metadata) {
  const lines = [
    '# Bundled FlexStudio Plugin Docs Index',
    '',
    `Source commit: \`${metadata.sourceCommit}\``,
    `Source path: \`${metadata.sourcePath}\``,
    '',
    'Load only the docs needed for the current task.',
    '',
    '| File | Use when |',
    '|---|---|',
  ]

  for (const fileName of DOC_FILE_ORDER) {
    lines.push(`| \`flexdoc/${fileName}\` | ${DOC_DESCRIPTIONS[fileName]} |`)
  }

  lines.push('')
  return lines.join('\n')
}

function readGitCommit(startDir) {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: startDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const dirty = execFileSync('git', ['status', '--porcelain', '--', '.'], {
      cwd: startDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return dirty ? `${commit}-dirty` : commit
  } catch {
    return 'unknown'
  }
}

async function writeGeneratedFiles(generated) {
  await rm(flexdocOutputRoot, { recursive: true, force: true })
  await mkdir(flexdocOutputRoot, { recursive: true })
  await mkdir(dirname(pluginDocsJsonPath), { recursive: true })

  for (const [filePath, content] of generated) {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
  }
}

async function checkGeneratedFiles(generated) {
  const actualEntries = existsSync(flexdocOutputRoot) ? await readdir(flexdocOutputRoot) : []
  const expectedFlexdocEntries = new Set([...DOC_FILE_ORDER, 'metadata.json'])
  const unexpected = actualEntries.filter((entry) => !expectedFlexdocEntries.has(entry))
  const failures = []

  for (const [filePath, expected] of generated) {
    if (!existsSync(filePath)) {
      failures.push(`Missing generated file: ${relative(filePath)}`)
      continue
    }
    const actual = await readFile(filePath, 'utf8')
    if (actual !== expected) {
      failures.push(`Outdated generated file: ${relative(filePath)}`)
    }
  }

  for (const entry of unexpected) {
    failures.push(`Unexpected generated file: ${relative(join(flexdocOutputRoot, entry))}`)
  }

  if (failures.length > 0) {
    throw new Error(`Plugin skill docs are not up to date:\n${failures.join('\n')}`)
  }
}

function relative(filePath) {
  return filePath.replace(`${repoRoot}\\`, '').replace(`${repoRoot}/`, '')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
