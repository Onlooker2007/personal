// Exercise model geometry and real event handlers without a browser or WebGL.
// This does not replace visual/real-device QA.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const root = path.resolve(__dirname,'..');
class Element {
  constructor(){this.children=[];this.events={};this.attrs={};this.value='0';this.checked=true;this.disabled=false;this.textContent='';this.style={};this.classList={toggle(){}};this.clientWidth=1050;this.clientHeight=610;}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  emit(name,extra={}){for(const fn of this.events[name]??[])fn({target:this,preventDefault(){},...extra});}
  setAttribute(name,value){this.attrs[name]=value;}
  append(...children){this.children.push(...children);}
  prepend(child){this.children.unshift(child);}
  remove(){}
  focus(){}
  click(){this.emit('click');}
  scrollIntoView(){}
  showModal(){this.open=true;}
  close(){this.open=false;this.emit('close');}
  querySelector(selector){return this[selector]??=new Element();}
  getBoundingClientRect(){return{left:0,top:0,right:1050,bottom:610,width:1050,height:610};}
}
class Renderer {
  constructor(){this.domElement=new Element();this.shadowMap={};}
  setPixelRatio(){} setSize(){} dispose(){}
  render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);}
}
async function main(){
  const elements=new Map();
  const removedSelectors=new Set(['#layer-list','#visible-count','#part-category','#part-title','#part-description','#part-label','#part-value','#isolate']);
  const get=s=>{assert.ok(!removedSelectors.has(s),`No access to removed sidebar: ${s}`);if(!elements.has(s))elements.set(s,new Element());return elements.get(s);};
  const modeButtons=['assembled','exploded','xray'].map(mode=>{const e=new Element();e.dataset={mode};return e;});
  const focusButtons=['frame','motion','sensors'].map(layer=>{const e=new Element();e.dataset={focusLayer:layer};return e;});
  const photos=Array.from({length:4},(_,i)=>{const e=new Element();e.querySelector('img').src=`photo${i}.jpg`;e.querySelector('img').alt=`Photo ${i}`;return e;});
  const document={hidden:false,documentElement:{classList:{contains:()=>false}},querySelector:get,createElement:()=>new Element(),addEventListener(){},querySelectorAll:s=>s==='[data-mode]'?modeButtons:s==='[data-focus-layer]'?focusButtons:s==='[data-photo]'?photos:[]};
  const source=fs.readFileSync(path.join(root,'dog-kit/doggie.js'),'utf8')
    .replace("import * as THREE from '../assets/vendor/three/three.module.js';", "import * as OriginalThree from '../assets/vendor/three/three.module.js'; const THREE={...OriginalThree,WebGLRenderer:globalThis.TestRenderer};")
    + '\nglobalThis.testAPI={THREE,parts,meshes,gait,orbit,selectPart,selectLayer,resetView,zoom,advanceDemo,render,getState:()=>({walking,explodeTarget,selectedLayer,xray,initialized,automaticDemo,demoIndex,demoChangedAt})};';
  const built=await esbuild.build({stdin:{contents:source,resolveDir:path.join(root,'dog-kit'),sourcefile:'doggie.js'},bundle:true,platform:'node',format:'cjs',write:false});
  const sandbox={window:{scrollY:0,innerHeight:900,addEventListener(){}},document,console,TestRenderer:Renderer,matchMedia:()=>({matches:false}),devicePixelRatio:1,performance,requestAnimationFrame:()=>1,ResizeObserver:class{observe(){}},IntersectionObserver:class{observe(){}},setTimeout};
  vm.runInNewContext(built.outputFiles[0].text,sandbox);
  const api=sandbox.testAPI;
  assert.equal(api.getState().initialized,true,'Model initializes');
  assert.equal(api.getState().demoIndex,0);
  let demoTime=api.getState().demoChangedAt;
  api.advanceDemo(demoTime+4999);assert.equal(api.getState().demoIndex,0);
  api.advanceDemo(demoTime+=5001);assert.equal(api.getState().explodeTarget,0);
  api.advanceDemo(demoTime+=5001);assert.equal(api.getState().xray,true);
  api.advanceDemo(demoTime+=5001);assert.equal(api.getState().walking,true);
  assert.ok(modeButtons.every(b=>b.attrs['aria-pressed']==='false'),'Only Walk is active while walking');
  api.advanceDemo(demoTime+=5001);assert.equal(api.getState().demoIndex,0);
  modeButtons[0].click();assert.equal(api.getState().automaticDemo,false);
  api.advanceDemo(demoTime+10000);assert.equal(api.getState().explodeTarget,0,'Manual choice stops cycling');
  assert.ok(api.parts.length>50,'Contains distinct interactive components');
  for(const p of api.parts){assert.ok(p.userData.title);assert.ok(p.children.length);}
  for(const m of api.meshes){
    const position=m.geometry.attributes.position;assert.ok(position.count>0);
    for(const value of position.array)assert.ok(Number.isFinite(value),'All geometric positions are finite');
    m.geometry.computeBoundingBox();assert.ok(!m.geometry.boundingBox.isEmpty());
  }
  modeButtons[1].click();assert.equal(api.getState().explodeTarget,.78);
  api.render(performance.now()+1200);
  assert.ok(api.parts.some(p=>p.position.distanceTo(p.userData.base)>.1),'Exploded parts move away from assembly positions');
  modeButtons[2].click();assert.equal(api.getState().xray,true);
  assert.ok(api.meshes.filter(m=>m.userData.part.userData.layer==='frame').every(m=>m.material.opacity===.16));
  assert.ok(api.meshes.filter(m=>m.userData.part.userData.layer==='sensors').some(m=>m.material.opacity===1));
  api.selectLayer('motion');assert.equal(api.getState().selectedLayer,'motion');
  assert.ok(api.parts.every(p=>p.visible),'Build notes highlight a system without hiding other parts');
  assert.ok(api.meshes.filter(m=>m.userData.part.userData.layer==='motion').every(m=>m.material.emissive.getHex()===0x5c260b));
  const head=api.parts.find(p=>p.userData.title==='Doggie 頭部面板');
  api.selectPart(head);
  assert.ok(api.meshes.filter(m=>m.userData.part===head).every(m=>m.material.emissive.getHex()===0x5c260b));
  assert.ok(api.parts.every(p=>p.visible),'Selecting a component keeps the complete model visible');
  api.resetView();assert.ok(api.parts.every(p=>p.visible));
  modeButtons[1].click();get('#walk').click();assert.equal(api.getState().walking,true);assert.equal(api.getState().explodeTarget,0,'Walking reassembles the dog');
  let gaitMoved=false;
  const walkingTime=performance.now()+1500;
  for(let offset=0;offset<=800;offset+=100){api.render(walkingTime+offset);gaitMoved ||= api.gait.some(g=>Math.abs(g.anchor.rotation.z)>.01);}
  assert.ok(gaitMoved,'Walking moves the legs across a gait cycle');
  modeButtons[1].click();assert.equal(api.getState().walking,false,'Exploding stops gait');
  api.resetView();api.render(performance.now()+5000);assert.equal(api.getState().walking,false);assert.equal(api.getState().selectedLayer,null);
  assert.ok(api.parts.every(p=>p.visible));
  const radius=api.orbit.targetRadius;api.zoom(.85);assert.ok(api.orbit.targetRadius<radius);
  get('#viewport').emit('keydown',{key:'ArrowLeft'});assert.ok(api.orbit.targetTheta<-.86);
  photos[0].click();assert.equal(get('#photo-dialog').open,true);get('#prev-photo').click();assert.equal(get('#large-photo').src,'photo3.jpg');get('#close-photo').click();assert.equal(get('#photo-dialog').open,false);
  const homepage=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(homepage,/href="dog-kit\/index.html"/);
  const html=fs.readFileSync(path.join(root,'dog-kit/index.html'),'utf8');
  assert.doesNotMatch(html,/parts-panel|layer-list|visible-count|component-detail|model-note|id="isolate"/,'Sidebar markup is removed');
  assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="assets\/doggie-icon.svg">/,'Doggie face is the favicon');
  assert.match(html,/<img class="brand-mark" src="assets\/doggie-icon.svg"/,'Page header uses the Doggie face');
  for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(!/^https?:/.test(match[1]))assert.ok(fs.existsSync(path.resolve(root,'dog-kit',match[1].split('#')[0])),`Local link exists: ${match[1]}`);}
  console.log(`PASS: ${api.parts.length} selectable parts, ${api.meshes.length} meshes; finite geometry, sidebar removal, Doggie icon links, component/system highlighting, x-ray, explosion, gait transitions, reset, zoom, keyboard, gallery and local links.`);
  console.log('Visual rendering, touch gestures and real WebGL require browser verification.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
