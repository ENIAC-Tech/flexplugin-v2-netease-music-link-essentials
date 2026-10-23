#!/usr/bin/env node
// The template owns skill/document synchronization; this plugin only selects its target.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const index = args.indexOf('--template-root');
const supplied = index >= 0 ? args.splice(index, 2)[1] : process.env.FLEX_PLUGIN_TEMPLATE_ROOT;
if (!supplied) {
  console.error('Provide --template-root <flex-plugin-template checkout> or FLEX_PLUGIN_TEMPLATE_ROOT to update the bundled skill.');
  process.exit(1);
}
if (args.includes('--target-root')) throw new Error('This wrapper only updates its own plugin.');
const script = join(resolve(supplied), 'scripts', 'sync-plugin-skill-docs.mjs');
if (!existsSync(script)) throw new Error(`Template sync script not found: ${script}`);
const result = spawnSync(process.execPath, [script, ...args, '--target-root', repoRoot], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
