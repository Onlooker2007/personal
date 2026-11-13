// Development only: the website itself needs no Node.js or build service.
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require(process.env.SKILL_POOL_ESBUILD_PATH || 'esbuild');
const root = path.resolve(__dirname, '..');

async function build() {
  const model = fs.readFileSync(path.join(root, 'assets/models/icon-pool-brand.glb'));
  fs.writeFileSync(path.join(root, 'assets/models/icon-pool-brand.data.js'),
    '// Generated from icon-pool-brand.glb. Rebuild with tools/build-skill-pool.cjs.\n' +
    'globalThis.__donaldSkillPoolModel=' + JSON.stringify(model.toString('base64')) + ';\n');
  await esbuild.build({
    entryPoints: [path.join(root, 'assets/js/skill-pool.js')],
    outfile: path.join(root, 'assets/js/skill-pool.bundle.js'),
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    minify: true,
    legalComments: 'eof'
  });
  console.log('Built the static Skills script and embedded model data.');
}
build().catch(error => { console.error(error); process.exitCode = 1; });
