import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { effects, intensity } from './patterns.js';

const $ = s => document.querySelector(s);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { effect:0, previous:0, transition:1, auto:!reducedMotion, paused:reducedMotion, speed:1, brightness:.8, palette:'ice', elapsed:0, sequence:0, ready:false };
let renderer, camera, controls, points, lensGlow, lensTint, pointGlow, pointTint, wireGroup;
let ledCoordinates = [], modelCenter = new THREE.Vector3();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#06090d');
scene.fog = new THREE.FogExp2('#06090d', .024);
const root = new THREE.Group();
scene.add(root);
const color = new THREE.Color();
const names = {ice:'Blue',aurora:'Blue / green',ember:'Orange / red'};
let heroVisible=true;
let lastMobileLayout;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 2400);
}

function fitCamera(reset = false) {
  const width = $('#stage').clientWidth, height = $('#stage').clientHeight;
  const mobile = width <= 700;
  renderer.setSize(width,height);
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.6 : 2));
  camera.aspect = width / height;
  camera.setViewOffset(width,height,mobile ? 0 : -width*.125,mobile ? height*.015 : -height*.025,width,height);
  camera.updateProjectionMatrix();
  if (reset||mobile!==lastMobileLayout) {
    const distance = document.documentElement.classList.contains('project-embed') ? 16.5 : (mobile ? 26 : (width/height < 1.45 ? 18 : 16.2));
    camera.position.set(distance*.57,distance*.36,distance*.73);
    controls.target.set(0,-.15,0);
    controls.update();
    controls.saveState();
  }
  lastMobileLayout=mobile;
}

function floor() {
  const grid = new THREE.GridHelper(32,48,0x142533,0x101b25);
  grid.position.y=-3.13;
  grid.material.transparent=true;grid.material.opacity=.29;
  scene.add(grid);
  const geometry = new THREE.PlaneGeometry(35,35);
  const material = new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{tint:{value:new THREE.Color('#1069a8')}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform vec3 tint;void main(){float d=length((vUv-.5)*2.);float a=exp(-d*d*36.)*.12;gl_FragColor=vec4(tint,a);}`});
  const glow = new THREE.Mesh(geometry,material);glow.rotation.x=-Math.PI/2;glow.position.y=-3.12;scene.add(glow);
  for (const r of [4.3,5.4]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r,r+.012,128),new THREE.MeshBasicMaterial({color:0x315369,transparent:true,opacity:.25,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.y=-3.11;scene.add(ring);
  }
}

async function loadModel() {
  const modelBytes=Uint8Array.from(atob(globalThis.__ledCubeModel),c=>c.charCodeAt(0));
  delete globalThis.__ledCubeModel;
  const gltf = await new GLTFLoader().parseAsync(modelBytes.buffer,'');
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);box.getCenter(modelCenter);
  // Preserve the physical Blender assembly, then batch static parts into a few draw calls.
  const content = new THREE.Group();content.position.copy(modelCenter).multiplyScalar(-1);
  root.scale.setScalar(40);root.add(content);
  wireGroup=new THREE.Group();content.add(wireGroup);
  const batches=new Map(), lenses=[];
  gltf.scene.traverse(object=>{
    if(!object.isMesh)return;
    const originalName=object.userData.name||object.name;
    if(originalName.includes('blue domed lens')) {lenses.push(object);return;}
    if(originalName.includes('semiconductor die'))return;
    const material=object.material;
    const key=material.name;
    if(!batches.has(key))batches.set(key,{material,geometries:[]});
    const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
    // All GLB parts use the same position/normal layout after removing unused UV data.
    for(const attr of Object.keys(geometry.attributes))if(!['position','normal'].includes(attr))geometry.deleteAttribute(attr);
    batches.get(key).geometries.push(geometry);
  });
  for(const [key,batch] of batches) {
    const material=batch.material.clone();
    material.color.set(key.includes('Wire')?0x69869b:key.includes('gold')?0x8a7b50:0x4d6475);
    material.metalness=.55;material.roughness=.4;
    const geometry=mergeGeometries(batch.geometries);
    if(!geometry)throw new Error('模型合併失敗：'+key);
    wireGroup.add(new THREE.Mesh(geometry,material));
    batch.geometries.forEach(g=>g.dispose());
  }
  lenses.sort((a,b)=>a.name.localeCompare(b.name));
  if(lenses.length!==216)throw new Error(`預期 216 顆 LED，實際 ${lenses.length}`);
  const lensGeometry=lenses[0].geometry.clone();
  lensGlow=new Float32Array(216);lensTint=new Float32Array(216*3);
  lensGeometry.setAttribute('aGlow',new THREE.InstancedBufferAttribute(lensGlow,1));
  lensGeometry.setAttribute('aTint',new THREE.InstancedBufferAttribute(lensTint,3));
  const lensMaterial=new THREE.ShaderMaterial({
    vertexShader:`attribute float aGlow;attribute vec3 aTint;varying float vGlow;varying vec3 vTint;varying vec3 vNormal;void main(){vGlow=aGlow;vTint=aTint;vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`varying float vGlow;varying vec3 vTint;varying vec3 vNormal;void main(){float rim=pow(1.-abs(normalize(vNormal).z),2.);vec3 base=vec3(.012,.037,.065)+vec3(.035,.09,.15)*rim;vec3 light=vTint*vGlow*(.52+rim*.2);gl_FragColor=vec4(base+light,1.);}`
  });
  const lensMesh=new THREE.InstancedMesh(lensGeometry,lensMaterial,216);content.add(lensMesh);
  const positions=new Float32Array(216*3);
  lenses.forEach((lens,i)=>{
    lensMesh.setMatrixAt(i,lens.matrixWorld);
    const {grid_x,grid_y,grid_z}=lens.userData;
    if(![grid_x,grid_y,grid_z].every(Number.isFinite))throw new Error('LED 座標無法辨識');
    ledCoordinates.push([grid_x-3.5,grid_z-3.5,grid_y-3.5]);
    lens.geometry.computeBoundingBox();
    const center=lens.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(lens.matrixWorld);
    center.toArray(positions,i*3);
  });
  const glowGeometry=new THREE.BufferGeometry();glowGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  pointGlow=new THREE.BufferAttribute(new Float32Array(216),1);pointTint=new THREE.BufferAttribute(new Float32Array(216*3),3);
  glowGeometry.setAttribute('aGlow',pointGlow);glowGeometry.setAttribute('aTint',pointTint);
  const glowMaterial=new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,
    uniforms:{uResolution:{value:innerHeight*renderer.getPixelRatio()}},
    vertexShader:`attribute float aGlow;attribute vec3 aTint;varying float vGlow;varying vec3 vTint;uniform float uResolution;void main(){vGlow=aGlow;vTint=aTint;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(uResolution*1.1/max(1.,-p.z),2.,150.);}`,
    fragmentShader:`varying float vGlow;varying vec3 vTint;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.||vGlow<.008)discard;float halo=exp(-r*r*9.)*.4;float core=exp(-r*r*180.)*1.6;float pin=exp(-r*r*130.);float alpha=(halo+core)*vGlow;gl_FragColor=vec4(mix(vTint,vec3(.86,.96,1.),pin*.96),alpha);}`
  });
  points=new THREE.Points(glowGeometry,glowMaterial);points.frustumCulled=false;points.renderOrder=4;content.add(points);
  state.ready=true;
  console.info('LIGHT CUBE ready: 216 independently animated LEDs; original GLB geometry.');
}

function updateLights(dt) {
  if(!state.ready)return;
  const t=state.elapsed;
  const blend=state.transition*state.transition*(3-2*state.transition);
  for(let i=0;i<216;i++) {
    const [x,y,z]=ledCoordinates[i];
    let value=intensity(state.effect,x,y,z,t);
    if(state.transition<1)value=THREE.MathUtils.lerp(intensity(state.previous,x,y,z,t),value,blend);
    const target=value*state.brightness;
    lensGlow[i]+= (target-lensGlow[i]) * (state.paused?1:1-Math.exp(-dt*13));
    pointGlow.array[i]=lensGlow[i];
    if(state.palette==='aurora')color.setHSL(.44+(y+2.5)*.038+.045*Math.sin(t*.3+x*.4),.9,.58);
    else if(state.palette==='ember')color.setHSL(.015+(y+2.5)*.012,.98,.59);
    else color.setRGB(.15,.58,1);
    color.toArray(lensTint,i*3);color.toArray(pointTint.array,i*3);
  }
  const mesh=root.children[0].children.find(c=>c.isInstancedMesh);
  mesh.geometry.attributes.aGlow.needsUpdate=true;mesh.geometry.attributes.aTint.needsUpdate=true;
  pointGlow.needsUpdate=true;pointTint.needsUpdate=true;
  if($('#led-count'))$('#led-count').textContent=`${lensGlow.filter(v=>v>.12).length.toString().padStart(3,'0')} / 216 LEDs ACTIVE`;
}

function selectEffect(index,manual=false) {
  state.previous=state.effect;state.effect=(index+8)%8;state.transition=state.paused?1:0;state.sequence=0;
  if(manual)setAuto(false);
  document.querySelectorAll('.effect').forEach((button,i)=>{button.classList.toggle('active',i===state.effect);button.setAttribute('aria-pressed',String(i===state.effect));});
  if($('#effect-title'))$('#effect-title').textContent=effects[state.effect];if($('#effect-index'))$('#effect-index').textContent=`${String(state.effect+1).padStart(2,'0')} / 08`;
  $('#sequence-progress').style.width='0%';
}
function setAuto(value) {state.auto=value;$('#autoplay')?.classList.toggle('active',value);$('#autoplay')?.setAttribute('aria-pressed',String(value));}
function setPaused(value) {
  state.paused=value;if(!$('#pause'))return;$('#pause').setAttribute('aria-pressed',String(value));$('#pause').setAttribute('aria-label',value?'Play animation':'Pause animation');
  $('#pause').innerHTML=value?'<svg viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg>':'<svg viewBox="0 0 20 20"><path d="M7 5v10M13 5v10" stroke="currentColor" stroke-width="2"/></svg>';
}
function toggleSettings(open) {$('#settings').hidden=!open;$('#settings-toggle').setAttribute('aria-expanded',String(open));}
async function toggleFullscreen() {
  try {if(document.fullscreenElement)await document.exitFullscreen();else await $('#experience').requestFullscreen();}
  catch {toast('Fullscreen is not supported in this browser.');}
}
function bindControls() {
  // A normal wheel scroll explores the project. Alt / Ctrl / Cmd + wheel zooms the sculpture.
  controls.enableZoom=true;
  renderer.domElement.addEventListener('wheel',e=>{
    if(!e.altKey&&!e.ctrlKey&&!e.metaKey)e.stopImmediatePropagation();
  },{capture:true,passive:true});
  document.querySelectorAll('.effect').forEach(button=>button.addEventListener('click',()=>selectEffect(Number(button.dataset.effect),true)));
  $('#autoplay')?.addEventListener('click',()=>{setAuto(!state.auto);state.sequence=0;});
  $('#pause')?.addEventListener('click',()=>setPaused(!state.paused));
  $('#settings-toggle').addEventListener('click',()=>toggleSettings($('#settings').hidden));
  $('#close-settings').addEventListener('click',()=>toggleSettings(false));
  $('#speed').addEventListener('input',e=>{state.speed=Number(e.target.value);$('#speed-value').value=state.speed.toFixed(1)+'×';});
  $('#brightness').addEventListener('input',e=>{state.brightness=Number(e.target.value);$('#brightness-value').value=Math.round(state.brightness*100)+'%';});
  document.querySelectorAll('.palette').forEach(button=>button.addEventListener('click',()=>{
    state.palette=button.dataset.palette;$('#palette-label').textContent=names[state.palette];
    document.querySelectorAll('.palette').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  }));
  $('#show-wires').addEventListener('change',e=>{if(wireGroup)wireGroup.visible=e.target.checked;});
  $('#reset-view')?.addEventListener('click',()=>{fitCamera(true);toast('View reset.');});
  $('#fullscreen')?.addEventListener('click',toggleFullscreen);
  $('#capture')?.addEventListener('click',()=>{
    if(!state.ready){toast('The model is still loading.');return;}
    renderer.render(scene,camera);
    renderer.domElement.toBlob(blob=>{
      if(!blob){toast('Could not save the image. Please try again.');return;}
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`light-cube-${effects[state.effect].replaceAll(' ','-').toLowerCase()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('3D image saved.');
    },'image/png');
  });
  document.addEventListener('keydown',e=>{
    if(!heroVisible)return;
    if(e.target.matches('input,textarea,select,button,a'))return;
    if(e.code==='Space'){e.preventDefault();setPaused(!state.paused);}
    if(e.key==='ArrowRight'){e.preventDefault();selectEffect(state.effect+1,true);}
    if(e.key==='ArrowLeft'){e.preventDefault();selectEffect(state.effect-1,true);}
    if(e.key.toLowerCase()==='f')toggleFullscreen();
    if(e.key==='Escape')toggleSettings(false);
  });
  addEventListener('resize',()=>{fitCamera();if(points)points.material.uniforms.uResolution.value=$('#stage').clientHeight*renderer.getPixelRatio();});
  document.addEventListener('visibilitychange',()=>{previousTime=performance.now();});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('Graphics context lost. Please reload the page.');});
  setAuto(state.auto);setPaused(state.paused);
}

function bindProjectContent() {
  const views={
    assembly:{file:'led-cube-structure.png',label:'01 / COMPLETE ASSEMBLY',alt:'3D render of the complete six-layer LED cube and its connecting wires',caption:'Complete assembly: six LED layers and 36 vertical column wires.'},
    layer:{file:'led-cube-single-layer.png',label:'02 / SINGLE LAYER',alt:'3D render of a single layer of 36 LEDs, their leads, and horizontal wires',caption:'Single layer: 36 LEDs and the horizontal layer wires.'},
    top:{file:'led-cube-top.png',label:'03 / TOP VIEW',alt:'Top view of the six-by-six LED grid and connecting wires',caption:'Top view: LED spacing and wire layout.'}
  };
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    const view=views[button.dataset.view];
    $('#assembly-image').src='./assets/images/'+view.file;$('#assembly-image').alt=view.alt;
    $('#assembly-view-label').textContent=view.label;$('#assembly-caption').textContent=view.caption;
    document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  }));
  document.querySelectorAll('[data-preview-effect]').forEach(button=>button.addEventListener('click',()=>{
    if(state.ready){setPaused(false);selectEffect(Number(button.dataset.previewEffect),true);}
    $('#experience').scrollIntoView({behavior:reducedMotion?'instant':'smooth'});
  }));
  new IntersectionObserver(entries=>{
    heroVisible=entries[0].isIntersecting;previousTime=performance.now();
  },{threshold:0}).observe($('#experience'));
  const chapterObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
      document.querySelectorAll('.chapter-bar nav a').forEach(link=>{
        if(link.hash==='#'+entry.target.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
      });
    }
  },{rootMargin:'-18% 0px -55% 0px',threshold:0});
  document.querySelectorAll('#about,#structure,#patterns,#process').forEach(section=>chapterObserver.observe(section));
}

let previousTime=performance.now(),frameCount=0,frameTime=0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt=Math.min((now-previousTime)/1000,.05);previousTime=now;
  if(document.hidden||!heroVisible)return;
  if(state.ready&&!state.paused) {
    state.elapsed+=dt*state.speed;state.transition=Math.min(1,state.transition+dt);
    if(state.auto){state.sequence+=dt;if(state.sequence>=14)selectEffect(state.effect+1);}
  }
  controls.autoRotate=$('#auto-rotate').checked&&!state.paused;
  controls.update(dt);updateLights(dt);renderer.render(scene,camera);
  $('#sequence-progress').style.width=state.auto?`${state.sequence/14*100}%`:'0%';
  frameCount++;frameTime+=dt;
  if(frameTime>1){if($('#fps'))$('#fps').textContent=`${Math.round(frameCount/frameTime)} FPS`;frameCount=0;frameTime=0;}
}

async function init() {
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    $('#stage').append(renderer.domElement);
    camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,.1,100);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;
    controls.minDistance=9;controls.maxDistance=36;controls.maxPolarAngle=Math.PI*.74;controls.autoRotateSpeed=.48;
    scene.add(new THREE.HemisphereLight(0xa4dcff,0x0b1726,2));
    const key=new THREE.DirectionalLight(0xc6e4ff,3);key.position.set(-4,7,5);scene.add(key);
    const rim=new THREE.DirectionalLight(0x398adf,2);rim.position.set(5,2,-5);scene.add(rim);
    floor();fitCamera(true);bindControls();
    await loadModel();
    if(reducedMotion){state.effect=7;state.previous=7;selectEffect(7);state.transition=1;}
    updateLights(.05);renderer.render(scene,camera);
    $('#loading').classList.add('done');
    setTimeout(()=>{
      $('#loading').hidden=true;
      const hint=$('#rotation-hint');
      if(hint){hint.hidden=false;setTimeout(()=>hint.hidden=true,2000);}
    },700);
    requestAnimationFrame(animate);
  }catch(error){
    console.error(error);
    $('#loading').innerHTML='<div class="loader-cube">◇</div><span>MODEL COULD NOT LOAD</span><small>Open this page through a local server and check that WebGL is supported.</small><button class="capture" style="width:160px;justify-content:center" onclick="location.reload()">Reload</button>';
  }
}
bindProjectContent();
init();
