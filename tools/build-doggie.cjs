// Bundle locally vendored Three.js so the page also works when opened via file://.
const path = require('node:path');
const esbuild = require(process.env.SKILL_POOL_ESBUILD_PATH || 'esbuild');
const root = path.resolve(__dirname, '..');
esbuild.build({
  entryPoints:[path.join(root,'dog-kit/doggie.js')],
  outfile:path.join(root,'dog-kit/doggie.bundle.js'),
  bundle:true, format:'iife', target:['es2020'], minify:true, legalComments:'eof'
}).then(()=>console.log('Built offline-ready Doggie explorer.')).catch(error=>{console.error(error);process.exitCode=1;});
