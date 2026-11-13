import * as THREE from '../assets/vendor/three/three.module.js';

const $ = (selector) => document.querySelector(selector);
const parts = [], meshes = [], gait = [];
let scene, camera, renderer, robot, shadow, selection = null, selectedLayer = null;
let autoRotate = false, walking = false, xray = false, explodeTarget = 0, explodeCurrent = 0;
let raf = null, inView = true, initialized = false, mode = 'assembled';
let automaticDemo = true, demoIndex = 0, demoChangedAt = 0;
const demoStates = ['exploded', 'assembled', 'xray', 'walk'];
function applyDemoState(index) {
  demoIndex = index;
  const next = demoStates[index];
  setMode(next === 'walk' ? 'assembled' : next);
  if(next === 'walk') { walking = true; updateWalk(); }
}
function advanceDemo(now) {
  if(!automaticDemo || now - demoChangedAt < 5000) return;
  applyDemoState((demoIndex + 1) % demoStates.length);
  demoChangedAt = now;
}
function stopAutomaticDemo() { automaticDemo = false; }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const orbit = { theta:-.86, phi:1.10, radius:9.8, targetTheta:-.86, targetPhi:1.10, targetRadius:9.8 };
const stage = $('#viewport');
const backToTop = $('.doggie-back-to-top');
function updateBackToTop() {
  backToTop.hidden = window.scrollY <= window.innerHeight * .5;
}
window.addEventListener('scroll', updateBackToTop, {passive:true});
window.addEventListener('resize', updateBackToTop);
window.addEventListener('pageshow', updateBackToTop);
updateBackToTop();
function showInteractionHints() {
  const hint = $('#interaction-hint');
  const rotateHint = $('#rotate-hint');
  const zoomHint = $('#zoom-hint');
  rotateHint.hidden = false;
  zoomHint.hidden = true;
  hint.hidden = false;
  setTimeout(() => {
    rotateHint.hidden = true;
    zoomHint.hidden = false;
  }, 2000);
  setTimeout(() => { hint.hidden = true; }, 4000);
}
function selectLayer(id) {
  selection = null; selectedLayer = id;
  updateSelection();
}
function selectPart(part) {
  selection = part; selectedLayer = part.userData.layer;
  updateSelection();
}
function updateSelection() {
  meshes.forEach(mesh => {
    const chosen = selection ? mesh.userData.part === selection : selectedLayer && mesh.userData.part.userData.layer === selectedLayer;
    mesh.material.emissive?.setHex(chosen ? 0x5c260b : mesh.userData.emissive);
    if(mesh.material.emissive) mesh.material.emissiveIntensity = chosen ? .7 : 1;
  });
}

function setMode(next) {
  mode = next; xray = next === 'xray';
  explodeTarget = next === 'exploded' ? .78 : 0;
  document.querySelectorAll('[data-mode]').forEach(b => {b.classList.toggle('active',b.dataset.mode === mode); b.setAttribute('aria-pressed',String(b.dataset.mode === mode));});
  meshes.forEach(mesh => {
    const transparent = xray && mesh.userData.part.userData.layer === 'frame';
    mesh.material.opacity = transparent ? .16 : mesh.userData.opacity;
    mesh.material.transparent = transparent || mesh.userData.opacity < 1;
    mesh.material.depthWrite = !transparent; mesh.material.needsUpdate = true;
  });
  walking = false; updateWalk();
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click',()=> { stopAutomaticDemo(); setMode(b.dataset.mode); }));
function zoom(factor) { orbit.targetRadius = THREE.MathUtils.clamp(orbit.targetRadius*factor,5.5,19); }
function updateWalk(){
  $('#walk').setAttribute('aria-pressed',String(walking));
  $('#walk').setAttribute('aria-label',walking?'Pause walking':'Walk');
  $('#walk').classList.toggle('active',walking);
  document.querySelectorAll('[data-mode]').forEach(b => {
    const active = !walking && b.dataset.mode === mode;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',String(active));
  });
}
$('#walk').addEventListener('click',()=> { stopAutomaticDemo(); if(!walking) setMode('assembled'); walking = !walking; updateWalk(); });
function resetView() {
  stopAutomaticDemo();
  Object.assign(orbit,{targetTheta:-.86,targetPhi:1.10,targetRadius:9.8});
  autoRotate = walking = false; selection = selectedLayer = null;
  setMode('assembled'); updateWalk(); updateSelection();
}

document.querySelectorAll('[data-focus-layer]').forEach(b=>b.addEventListener('click',()=> { selectLayer(b.dataset.focusLayer); $('#explorer').scrollIntoView({behavior:reducedMotion?'instant':'smooth'}); }));

const M = {};
function material(color,metalness=0,roughness=.5,opacity=1) { return new THREE.MeshStandardMaterial({color,metalness,roughness,transparent:opacity<1,opacity,side:THREE.DoubleSide}); }
function part(title,layer,description,position,spread,parent=robot) {
  const group = new THREE.Group(); group.position.set(...position);
  group.userData = {title,layer,description,base:new THREE.Vector3(...position),spread:new THREE.Vector3(...spread)};
  parent.add(group); parts.push(group); return group;
}
function mesh(group,geometry,mat,position=[0,0,0],rotation=[0,0,0]) {
  const obj = new THREE.Mesh(geometry,mat.clone()); obj.position.set(...position); obj.rotation.set(...rotation); obj.castShadow = true; obj.receiveShadow = true;
  obj.userData = {part:group,opacity:mat.opacity,emissive:mat.emissive?.getHex() ?? 0}; group.add(obj); meshes.push(obj); return obj;
}
function box(g,w,h,d,mat,p=[0,0,0],r=[0,0,0]) { return mesh(g,new THREE.BoxGeometry(w,h,d),mat,p,r); }
function cylinder(g,r,h,mat,p=[0,0,0],rotation=[0,0,0],segments=24) { return mesh(g,new THREE.CylinderGeometry(r,r,h,segments),mat,p,rotation); }
function plate(g,points,depth,mat,holes=[],position=[0,0,0],rotation=[0,0,0]) {
  const shape = new THREE.Shape(); points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y)); shape.closePath();
  holes.forEach(h=>{const path=new THREE.Path(); if(h.type==='rect'){const [x,y,w,hh]=h.rect;path.moveTo(x,y);path.lineTo(x,y+hh);path.lineTo(x+w,y+hh);path.lineTo(x+w,y);path.closePath();}else{path.absarc(h.x,h.y,h.r,0,Math.PI*2,true);}shape.holes.push(path);});
  const geometry = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.012,bevelThickness:.012}); geometry.translate(0,0,-depth/2);
  return mesh(g,geometry,mat,position,rotation);
}
function screw(parent,position,rotation=[Math.PI/2,0,0]) {
  const g = part('固定螺絲','frame','連接壓克力板、支架與模組的固定件。位置依照片概略配置。',position,[position[0]*.1,.13,position[2]*.22],parent);
  cylinder(g,.049,.035,M.silver,[0,0,0],rotation,12);
  box(g,.052,.008,.009,M.dark,[0,-.022,0],rotation); return g;
}
function wire(title,points,color,spread=[0,0,0],radius=.022) {
  const g=part(title,'power','連接控制板與伺服模組的訊號或電源線。路徑依外觀示意，實際接線請依套件文件確認。',[0,0,0],spread);
  mesh(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,radius,6,false),M[color]);
}
function board(title,position,w,d,spread,raspberry=false) {
  const g = part(title,'electronics',raspberry?'機身頂部的單板電腦，以照片中的綠色板身、USB 與網路連接埠重建外觀。此示意不指定確切板卡版本。':'下層的控制與擴充電路板，將訊號分配至伺服及感測模組。元件與腳位以示意方式呈現。',position,spread);
  box(g,w,.055,d,M.green);
  box(g,.54,.065,.48,M.chip,[-.12,.06,0]);
  for(let i=0;i<6;i++)box(g,.15,.035,.09,M.chip,[-w*.28+i*.17,.055,d*.28]);
  for(let x of [-1,1])for(let z of [-1,1])cylinder(g,.049,.064,M.gold,[x*(w/2-.13),0,z*(d/2-.12)]);
  if(raspberry){
    for(let z of [-.36,.36]) {box(g,.43,.33,.52,M.silver,[w/2-.04,.18,z]);box(g,.012,.22,.4,M.dark,[w/2+.181,.18,z]);}
    box(g,.46,.37,.48,M.silver,[w/2-.06,.2,.83]);box(g,.012,.25,.34,M.dark,[w/2+.176,.19,.83]);
    box(g,.26,.1,.3,M.silver,[-w*.25,.08,-d/2]);
    box(g,1.26,.11,.16,M.dark,[-.13,.08,d/2-.12]);
    for(let i=0;i<20;i++)for(let z of [-.037,.037])cylinder(g,.011,.17,M.gold,[-.7+i*.059,.15,d/2-.12+z], [0,0,0],6);
    cylinder(g,.025,.035,M.led,[.65,.06,-.6]);
  }else{
    for(let i=0;i<12;i++){box(g,.08,.12,.08,M.red,[-.9+i*.16,.09,-d*.32]);cylinder(g,.017,.21,M.gold,[-.9+i*.16,.1,d*.32],[0,0,0],6);}
  }
  return g;
}
function createRobot() {
  Object.assign(M,{black:material(0x151b20,.28,.31),dark:material(0x090d11,.1,.5),silver:material(0xbac2c5,.84,.24),green:material(0x22784d,.18,.48),gold:material(0xc8a55d,.7,.3),chip:material(0x202729,.12,.55),blue:material(0x1644b5,.25,.25,.88),white:material(0xeee9d8,.1,.55),orange:material(0xec8b1f),red:material(0xa23224),brown:material(0x5d3022),led:material(0xa7de45)});
  M.led.emissive.setHex(0x67ad19);
  robot = new THREE.Group(); scene.add(robot);
  // Two laser-cut side frames with large real openings and mounting holes.
  for(const z of [-.87,.87]) {
    const g=part(z<0?'右側機身框架':'左側機身框架','frame','長方形鏤空壓克力側板提供機身支撐，兩端延伸處連接腿部模組。', [0,2.22,z],[0,.1,z*1.5]);
    plate(g,[[-2.1,-.61],[-2.1,.48],[-1.65,.66],[1.65,.66],[2.1,.48],[2.1,-.61]],.075,M.black,[{type:'rect',rect:[-1.52,-.38,3.04,.76]},...[-1.82,1.82].map(x=>({x,y:.16,r:.1}))]);
    for(const x of [-1.8,1.8])screw(robot,[x,2.55,z*1.05]);
  }
  for(const x of [-1.83,1.83]) {
    const g=part(x<0?'前端橫向支架':'後端橫向支架','frame','連接機身左右側板，保持板間距與整體剛性。',[x,2.13,0],[x*.45,-.15,0]);
    box(g,.14,.72,1.7,M.black); box(g,.34,.08,1.7,M.black,[0,.4,0]);
  }
  for(const y of [1.82,2.83]) {
    const g=part(y<2?'底層承載板':'上層電路承載板','frame','固定控制與電源模組的壓克力板。中間開孔保留安裝與走線空間。',[0,y,0],[0,y<2?-.8:.65,0]);
    plate(g,[[-1.8,-.8],[1.8,-.8],[1.8,.8],[-1.8,.8]],.065,M.black,[{type:'rect',rect:[-.95,-.44,1.9,.88]}],[0,0,0],[-Math.PI/2,0,0]);
  }
  board('Raspberry Pi 運算板',[.34,3.27,0],2.25,1.65,[.1,2.1,0],true);
  board('伺服控制擴充板',[.15,2.98,0],2.8,1.6,[.1,1.15,0]);
  for(const x of [-.55,1.2])for(const z of [-.62,.62]) {
    const g=part('電路板支撐柱','electronics','隔開上下層電路板，提供固定間距與安裝位置。',[x,3.12,z],[0,1.55,z*.2]);cylinder(g,.045,.25,M.gold);
  }
  const power=part('雙槽電池座','power','依套件拆解照片重建的雙槽電池座，安裝於機身下層。未由照片推定實際電池規格。',[.2,1.92,0],[0,-1.1,0]);
  box(power,2.3,.18,1.35,M.dark);for(const z of [-.35,.35]){box(power,2.3,.28,.035,M.black,[0,.2,z-.29]);box(power,.07,.32,.58,M.dark,[-1.1,.2,z]);box(power,.07,.32,.58,M.dark,[1.1,.2,z]);for(let i=0;i<4;i++)cylinder(power,.16,.015,M.silver,[.95-i*.055,.18,z],[0,0,Math.PI/2],16);}

  // Distinct hip, knee, servo horn, acrylic link and forked toe for every leg.
  let legIndex = 0;
  for(const x of [-1.45,1.45])for(const z of [-1.13,1.13]) {
    const side = `${x<0?'前':'後'}${z>0?'左':'右'}`;
    const anchor = new THREE.Group();anchor.position.set(x,2.28,z);robot.add(anchor);
    const phase = (x*z>0)?0:Math.PI;
    const hip = part(`${side}腿髖部伺服`,'motion','髖部伺服的輸出軸帶動上段腿部連桿，使足端前後擺動。',[0,0,0],[x*.75,0,z*1.1],anchor);
    box(hip,.49,.51,.39,M.dark);box(hip,.56,.06,.43,M.black,[0,.19,0]);
    const horn=part(`${side}腿髖部舵盤`,'motion','舵盤連接伺服輸出軸與壓克力連桿；圓周小孔提供固定位置。',[0,0,z>0?.26:-.26],[x*.75,0,z*1.4],anchor);
    cylinder(horn,.19,.035,M.white,[0,0,0],[Math.PI/2,0,0]);cylinder(horn,.055,.05,M.silver,[0,0,z>0?.02:-.02],[Math.PI/2,0,0]);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(horn,.012,.037,M.dark,[Math.cos(a)*.13,Math.sin(a)*.13,0],[Math.PI/2,0,0],6);}
    const upper=part(`${side}腿上段連桿`,'motion','黑色壓克力上段連桿，將髖部轉動傳遞至膝部。',[0,-.59,z>0?.3:-.3],[x*.8,0,z*1.7],anchor);
    plate(upper,[[-.19,.65],[.17,.65],[.12,-.22],[.25,-.52],[.19,-.72],[-.17,-.72],[-.22,-.55],[-.1,-.25]],.065,M.black,[{x:0,y:.48,r:.05},{x:0,y:-.55,r:.06}]);
    const kneePivot = new THREE.Group(); kneePivot.position.set(0,-1.22,z>0?.14:-.14);anchor.add(kneePivot);
    const knee=part(`${side}腿膝部伺服`,'motion','膝部伺服調整下段腿角度，與髖部共同改變足端位置。',[0,0,0],[x*.8,-.4,z*1.2],kneePivot);
    box(knee,.47,.4,.4,M.dark);cylinder(knee,.13,.065,M.silver,[0,0,z>0?.25:-.25],[Math.PI/2,0,0]);
    const lower=part(`${side}腿下段與腳掌`,'motion','彎折的下段連桿延伸至叉形腳掌，接觸面以條紋表現。',[0,-.5,z>0?.31:-.31],[x*.85,-.9,z*1.7],kneePivot);
    plate(lower,[[-.15,.59],[.18,.59],[.2,.26],[-.27,-.3],[-.66,-.49],[-.75,-.4],[-.39,-.13],[-.1,.35]],.09,M.black,[{x:0,y:.43,r:.045}]);
    box(lower,.51,.07,.15,M.dark,[-.65,-.48,0]);
    for(let j=0;j<5;j++)box(lower,.035,.025,.17,M.black,[-.85+j*.085,-.515,0]);
    const legScrew=part(`${side}腿連桿固定螺絲`,'motion','固定腿部連桿與舵盤的中心螺絲。',[0,-.05,z>0?.37:-.37],[x*.8,0,z*1.9],anchor);
    cylinder(legScrew,.045,.04,M.silver,[0,0,0],[Math.PI/2,0,0],12);
    gait.push({anchor,knee:kneePivot,phase,index:legIndex++});
    for(const [offset,color] of [[0,'brown'],[.055,'red'],[.11,'orange']])wire(`${side}腿${color==='orange'?'訊號':'電源'}線`,[[.1,2.98,z*.55],[x*.6,2.85+offset,z],[x,2.65+offset,z*1.15],[x,2.32,z]],color,[x*.6,.2,z*1.2]);
  }
  const neck=part('藍色頭部伺服','sensors','照片中位於頭部後方的藍色微型伺服，用於改變頭部朝向。',[-2.15,2.65,0],[-1.3,.5,0]);
  box(neck,.53,.57,.55,M.blue);box(neck,.66,.055,.58,M.blue,[0,.22,0]);cylinder(neck,.13,.14,M.white,[0,.35,0]);
  const face=part('Doggie 頭部面板','sensors','具有雙耳輪廓的黑色壓克力前面板，雙圓開口與下方方孔對應感測及攝影模組。',[-2.64,2.6,0],[-2,.5,0]);
  plate(face,[[-.85,-.72],[-.88,.65],[-.72,1.08],[-.38,.78],[.36,.78],[.7,1.08],[.86,.66],[.85,-.72],[.6,-.93],[-.6,-.93]],.085,M.black,[{x:-.43,y:.28,r:.3},{x:.43,y:.28,r:.3},{x:0,y:-.31,r:.065},{type:'rect',rect:[-.18,-.73,.36,.3]}],[0,0,0],[0,-Math.PI/2,0]);
  const sensor=part('雙探頭超音波模組','sensors','並排的金屬圓筒為超音波模組外觀，可用於距離感測；此頁不模擬實際量測。',[-2.7,2.88,0],[-2.45,.5,0]);
  box(sensor,.065,.65,1.55,M.green,[.13,0,0]);
  for(const z of [-.43,.43]) {
    cylinder(sensor,.3,.16,M.silver,[0,0,z],[0,0,Math.PI/2]);cylinder(sensor,.235,.17,M.dark,[-.01,0,z],[0,0,Math.PI/2]);
    const grille=new THREE.Group(); sensor.add(grille);
    for(let j=-3;j<=3;j++){const yy=j*.052;const span=Math.sqrt(.22*.22-yy*yy);box(sensor,.012,.009,span*2,M.chip,[-.1,yy,z]);box(sensor,.012,span*2,.009,M.chip,[-.101,0,z+yy]);}
  }
  const cam=part('前視攝影機','sensors','安裝在頭部下方的鏡頭模組。白色排線沿機身回接運算板。',[-2.71,2.03,0],[-2.4,-.1,0]);
  box(cam,.075,.35,.35,M.green);box(cam,.1,.28,.28,M.dark,[-.065,0,0]);cylinder(cam,.1,.11,M.chip,[-.14,0,0],[0,0,Math.PI/2]);cylinder(cam,.065,.115,M.blue,[-.15,0,0],[0,0,Math.PI/2]);
  for(const z of [-.72,.72]){const g=part('頭部固定螺絲','sensors','固定感測前面板與頭部支架的螺絲。',[-2.7,2.1,z],[-2.2,.3,z*.2]);cylinder(g,.048,.05,M.silver,[0,0,0],[0,0,Math.PI/2],12);}
  const ribbon=part('攝影機白色排線','power','寬幅白色排線沿頭部下方彎回機身，外觀依實物照片重建。',[0,0,0],[0,-.15,1.3]);
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(-2.63,2,0),new THREE.Vector3(-2.4,1.54,.3),new THREE.Vector3(-1.1,1.6,1.05),new THREE.Vector3(.15,2.15,1.1),new THREE.Vector3(.48,3.58,.75),new THREE.Vector3(.65,3.3,.3)]);
  const verts=[],indices=[];
  for(let i=0;i<=70;i++){const p=path.getPoint(i/70);verts.push(p.x-.18,p.y,p.z,p.x+.18,p.y,p.z);if(i<70){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(ribbon,geometry,M.white);
  for(let i=0;i<5;i++){const points=[];for(let j=0;j<=25;j++){const p=path.getPoint(j/25);p.x+=(i-2)*.058;points.push(p);}mesh(ribbon,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.0025,3,false),M.silver);}
}

let startTime=0,lastTime=0;
function render(now) {
  raf=null; if(!inView || document.hidden || !initialized)return;
  const dt=Math.min((now-lastTime)/1000 || .016,.05);lastTime=now;
  advanceDemo(now);
  if(autoRotate)orbit.targetTheta+=dt*.23;
  const blend=1-Math.exp(-dt*10);
  for(const key of ['Theta','Phi','Radius']){const lower=key.toLowerCase();orbit[lower]+=(orbit[`target${key}`]-orbit[lower])*blend;}
  explodeCurrent = reducedMotion ? explodeTarget : THREE.MathUtils.lerp(explodeCurrent,explodeTarget,blend);
  const center=new THREE.Vector3(0,1.6+explodeCurrent*.25,0);
  const mobile=stage.clientWidth<600;
  const framing=Math.max(mobile?1.25:1,.95/camera.aspect)*(document.documentElement.classList.contains('project-embed')?1.14:1);
  const radius=orbit.radius*framing*(1+explodeCurrent*.48);
  camera.position.set(center.x+radius*Math.sin(orbit.phi)*Math.sin(orbit.theta),center.y+radius*Math.cos(orbit.phi),center.z+radius*Math.sin(orbit.phi)*Math.cos(orbit.theta));camera.lookAt(center);
  for(const p of parts)p.position.copy(p.userData.base).addScaledVector(p.userData.spread,explodeCurrent);
  const t=(now-startTime)/1000;
  gait.forEach(g=>{g.anchor.rotation.z=walking?Math.sin(t*3.8+g.phase)*.25:0;g.knee.rotation.z=walking?Math.max(0,Math.sin(t*3.8+g.phase+.7))*.38:0;});
  robot.position.y=walking?Math.sin(t*7.6)*.035:0;
  shadow.material.opacity=.12*(1-explodeCurrent*.7);
  renderer.render(scene,camera);raf=requestAnimationFrame(render);
}
function resume(){if(initialized&&inView&&!document.hidden&&raf===null){lastTime=performance.now();raf=requestAnimationFrame(render);}}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
function init() {
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;stage.prepend(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden','true');
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.1,80);
    scene.add(new THREE.HemisphereLight(0xffffff,0x7d8867,3));
    const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.normalBias=.035;scene.add(key);
    const rim=new THREE.DirectionalLight(0xd9e9ff,3);rim.position.set(4,5,-4);scene.add(rim);
    const front=new THREE.DirectionalLight(0xffffff,1.2);front.position.set(-5,2,-2);scene.add(front);
    const grid=new THREE.GridHelper(24,48,0xb9c4a6,0xd5ddc7);grid.position.y=-.18;grid.material.transparent=true;grid.material.opacity=.23;scene.add(grid);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-.17;floor.receiveShadow=true;scene.add(floor);shadow=floor;
    createRobot();resize();initialized=true;startTime=performance.now();
    new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)resume();},{rootMargin:'100px'}).observe(stage);
    document.addEventListener('visibilitychange',resume);
    setupPointer();applyDemoState(0);demoChangedAt=performance.now();resume();showInteractionHints();
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#fallback').hidden=false;});
  }catch(error){
    console.error('Doggie 3D initialization:',error);renderer?.dispose();renderer?.domElement.remove();
    $('#fallback').hidden=false;
    document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=true);$('#walk').disabled=true;
  }
}
function setupPointer(){
  const pointers=new Map();let origin=null,dragged=false,pinchDistance=0;
  const raycaster=new THREE.Raycaster();const cursor=new THREE.Vector2();
  function pick(event){const rect=stage.getBoundingClientRect();cursor.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(cursor,camera);const hits=raycaster.intersectObjects(meshes.filter(m=>m.userData.part.visible),false);return hits[0]?.object.userData.part;}
  stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;stage.focus({preventScroll:true});stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){origin={x:e.clientX,y:e.clientY};dragged=false;}else{dragged=true;const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}autoRotate=false;});
  stage.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev){stage.style.cursor=pick(e)?'pointer':'grab';return;}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()];const distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(distance>0&&pinchDistance>0)zoom(pinchDistance/distance);pinchDistance=distance;return;}const dx=e.clientX-prev.x,dy=e.clientY-prev.y;if(origin&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>5)dragged=true;orbit.targetTheta-=dx*.007;orbit.targetPhi=THREE.MathUtils.clamp(orbit.targetPhi-dy*.006,.25,1.65);stage.style.cursor='grabbing';});
  function end(e){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(e.type==='pointerup'&&!dragged&&pointers.size===0){const p=pick(e);if(p)selectPart(p);}stage.style.cursor='grab';pinchDistance=0;}
  stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
  stage.addEventListener('wheel',e=>{
    if(!e.ctrlKey) return;
    e.preventDefault();
    zoom(Math.exp(e.deltaY*.001));
  },{passive:false});
  stage.addEventListener('keydown',e=>{const actions={ArrowLeft:()=>orbit.targetTheta-=.15,ArrowRight:()=>orbit.targetTheta+=.15,ArrowUp:()=>orbit.targetPhi=Math.max(.25,orbit.targetPhi-.1),ArrowDown:()=>orbit.targetPhi=Math.min(1.65,orbit.targetPhi+.1),'+':()=>zoom(.9),'=':()=>zoom(.9),'-':()=>zoom(1.1),Home:resetView};if(actions[e.key]){e.preventDefault();actions[e.key]();}});
}

const photos=[...document.querySelectorAll('[data-photo]')];const dialog=$('#photo-dialog');let photoIndex=0,lastPhotoTrigger=null;
function showPhoto(index){photoIndex=(index+photos.length)%photos.length;const small=photos[photoIndex].querySelector('img');$('#large-photo').src=small.src;$('#large-photo').alt=small.alt;$('#photo-caption').textContent=photos[photoIndex].querySelector('span').textContent.replace('↗','');}
photos.forEach((b,i)=>b.addEventListener('click',()=>{lastPhotoTrigger=b;showPhoto(i);dialog.showModal();}));
$('#close-photo').addEventListener('click',()=>dialog.close());$('#prev-photo').addEventListener('click',()=>showPhoto(photoIndex-1));$('#next-photo').addEventListener('click',()=>showPhoto(photoIndex+1));
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();showPhoto(photoIndex-1);}if(e.key==='ArrowRight'){e.preventDefault();showPhoto(photoIndex+1);}});dialog.addEventListener('close',()=>lastPhotoTrigger?.focus());
init();
