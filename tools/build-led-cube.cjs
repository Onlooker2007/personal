const path=require('node:path');
const fs=require('node:fs');
const esbuild=require('esbuild');
const root=path.resolve(__dirname,'../led-cube');
async function build(){
  const bytes=fs.readFileSync(path.join(root,'assets/models/led-cube-6x6x6.glb'));
  fs.writeFileSync(path.join(root,'assets/models/led-cube.data.js'),'globalThis.__ledCubeModel='+JSON.stringify(bytes.toString('base64'))+';\n');
  await esbuild.build({entryPoints:[path.join(root,'app.js')],outfile:path.join(root,'app.bundle.js'),bundle:true,format:'iife',target:['es2020'],minify:true,legalComments:'eof',plugins:[{name:'local-three',setup(build){
    build.onResolve({filter:/^three$/},()=>({path:path.join(root,'assets/vendor/three.module.js')}));
    build.onResolve({filter:/^three\/addons\//},args=>({path:path.join(root,'assets/vendor',args.path.replace('three/addons/',''))}));
  }}]});
  console.log('Built file-compatible LED cube page.');
}
build().catch(error=>{console.error(error);process.exitCode=1;});
