// Rebuild with npm run build:skills after changing this source.
import { skills } from './skill-content.js';
const assetRoot = new URL('../', document.currentScript.src);
const stage = document.querySelector('#skill-pool-stage');
const status = document.querySelector('#skill-pool-status');
const targets = document.querySelector('#skill-ball-targets');
const detail = document.querySelector('.skill-detail');
let selected = 1, activate = null;
let achievementLightbox;
const isImageRecord = href => /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(href);

function imageUrl(href) {
  const url = new URL(href, document.baseURI);
  if (url.hostname === 'imgur.com' || url.hostname === 'www.imgur.com') url.hostname = 'i.imgur.com';
  return url.href;
}

function selectSkill(index) {
  selected = (index + skills.length) % skills.length;
  const skill = skills[selected];
  detail.style.setProperty('--skill-accent', skill.color);
  document.querySelector('#skill-detail-category').textContent = skill.category;
  document.querySelector('#skill-detail-number').textContent = `${String(selected + 1).padStart(2,'0')} / ${skills.length}`;
  document.querySelector('#skill-detail-title').textContent = skill.name;
  document.querySelector('#skill-detail-description').textContent = skill.description;
  document.querySelector('#skill-detail-counter').textContent = skill.name;
  const evidence = document.querySelector('#skill-detail-evidence');
  evidence.querySelector('h4').textContent = skill.recordHeading || 'Projects & Achievements';
  const records = document.querySelector('#skill-detail-records');
  records.replaceChildren();
  for (const [label, href] of skill.records) {
    const li = document.createElement('li'), a = document.createElement('a'), arrow = document.createElement('span');
    a.href = href; a.textContent = label;
    const image = isImageRecord(href);
    if (image) {
      a.setAttribute('aria-haspopup', 'dialog');
      a.setAttribute('aria-label', `${label} — enlarge certificate`);
      a.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (typeof globalThis.GLightbox !== 'function') return;
        event.preventDefault();
        const images = skill.records.filter(record => isImageRecord(record[1]));
        const elements = images.map(record => ({ href: imageUrl(record[1]), type: 'image' }));
        if (!achievementLightbox) achievementLightbox = globalThis.GLightbox({ elements, touchNavigation: true });
        else achievementLightbox.setElements(elements);
        achievementLightbox.openAt(images.findIndex(record => record[1] === href));
      });
    } else if (!href.startsWith('#')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    arrow.textContent = image ? '⊕' : '↗'; arrow.setAttribute('aria-hidden', 'true'); a.append(arrow); li.append(a); records.append(li);
  }
  evidence.hidden = skill.records.length === 0;
  targets.querySelectorAll('button').forEach((button,i) => button.setAttribute('aria-pressed', String(i===selected)));
}
document.querySelector('#skill-previous').addEventListener('click', () => { selectSkill(selected-1); activate?.(selected); });
document.querySelector('#skill-next').addEventListener('click', () => { selectSkill(selected+1); activate?.(selected); });
selectSkill(1);

// Reserve the tallest skill panel at the current width without switching the live content.
function sizeSkillPanel() {
  const width = detail.getBoundingClientRect().width;
  if (!width) return;
  const measurement = detail.cloneNode(true);
  measurement.setAttribute('aria-hidden', 'true');
  measurement.inert = true;
  Object.assign(measurement.style, {
    position: 'fixed', left: '-10000px', top: '0', visibility: 'hidden',
    width: `${width}px`, height: 'auto', minHeight: '0', maxHeight: 'none',
    boxSizing: 'border-box', pointerEvents: 'none'
  });
  document.body.append(measurement);
  let tallest = 0;
  for (const skill of skills) {
    measurement.querySelector('#skill-detail-title').textContent = skill.name;
    measurement.querySelector('#skill-detail-category').textContent = skill.category;
    measurement.querySelector('#skill-detail-description').textContent = skill.description;
    measurement.querySelector('#skill-detail-counter').textContent = skill.name;
    const evidence = measurement.querySelector('#skill-detail-evidence');
    evidence.hidden = skill.records.length === 0;
    evidence.querySelector('h4').textContent = skill.recordHeading || 'Projects & Achievements';
    const records = measurement.querySelector('#skill-detail-records');
    records.replaceChildren();
    for (const [label, href] of skill.records) {
      const li = document.createElement('li'), link = document.createElement('a'), arrow = document.createElement('span');
      link.textContent = label;
      arrow.textContent = isImageRecord(href) ? '⊕' : '↗';
      link.append(arrow); li.append(link); records.append(li);
    }
    tallest = Math.max(tallest, measurement.getBoundingClientRect().height);
  }
  measurement.remove();
  detail.style.minHeight = `${Math.ceil(tallest)}px`;
}
let panelSizeFrame;
function schedulePanelSize() {
  cancelAnimationFrame(panelSizeFrame);
  panelSizeFrame = requestAnimationFrame(sizeSkillPanel);
}
sizeSkillPanel();
let panelWidth = detail.getBoundingClientRect().width;
new ResizeObserver(entries => {
  const width = entries[0].borderBoxSize?.[0]?.inlineSize || detail.getBoundingClientRect().width;
  if (Math.abs(width - panelWidth) < .5) return;
  panelWidth = width;
  schedulePanelSize();
}).observe(detail);
window.addEventListener('resize', schedulePanelSize);
document.fonts?.ready.then(schedulePanelSize);
document.fonts?.addEventListener('loadingdone', schedulePanelSize);

async function loadModelData() {
  const script = document.createElement('script');
  script.src = new URL('models/icon-pool-brand.data.js', assetRoot).href;
  try {
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error('The skill model data could not load.'));
      document.head.append(script);
    });
    const encoded = globalThis.__donaldSkillPoolModel;
    if (typeof encoded !== 'string') throw new Error('Missing skill model data.');
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } finally {
    delete globalThis.__donaldSkillPoolModel;
    script.remove();
  }
}


async function init() {
  try {
    const [THREE, { GLTFLoader }] = await Promise.all([
      import('../vendor/three/three.module.js'), import('../vendor/three/GLTFLoader.js')
    ]);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const canvas = renderer.domElement; canvas.setAttribute('aria-hidden','true'); stage.prepend(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-6,6,6,-6,.1,60);
    camera.position.set(5,14,16); camera.lookAt(0,0,0);
    scene.add(new THREE.HemisphereLight(0xffffff,0x8eabc3,3));
    const key = new THREE.DirectionalLight(0xfffaf3,3.3); key.position.set(-5,12,9); key.castShadow=true;
    key.shadow.mapSize.set(1024,1024); key.shadow.normalBias=.03;
    Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.5,far:35}); scene.add(key);
    const fill = new THREE.DirectionalLight(0xb9dfff,1.8); fill.position.set(6,6,-6);scene.add(fill);
    const blue = new THREE.MeshPhysicalMaterial({color:0x237bbd,roughness:.28,metalness:.08,clearcoat:.7,clearcoatRoughness:.22});
    const wellMaterial = new THREE.MeshStandardMaterial({color:0x1a659b,roughness:.55});
    function roundedRect(size,r) {
      const s=new THREE.Shape(),a=size/2;
      s.moveTo(-a+r,-a);s.lineTo(a-r,-a);s.quadraticCurveTo(a,-a,a,-a+r);s.lineTo(a,a-r);s.quadraticCurveTo(a,a,a-r,a);s.lineTo(-a+r,a);s.quadraticCurveTo(-a,a,-a,a-r);s.lineTo(-a,-a+r);s.quadraticCurveTo(-a,-a,-a+r,-a);return s;
    }
    const base = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(7.8,.4),{depth:.16,bevelEnabled:true,bevelThickness:.09,bevelSize:.1,bevelSegments:4,curveSegments:18}),blue);
    base.rotation.x=-Math.PI/2;base.position.y=-.3;base.castShadow=base.receiveShadow=true;scene.add(base);
    const rimShape=roundedRect(7.85,.4);rimShape.holes.push(new THREE.Path(roundedRect(7.38,.35).getPoints(24)));
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(rimShape,{depth:.3,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:3,curveSegments:18}),blue);
    rim.rotation.x=-Math.PI/2;rim.position.y=-.15;rim.castShadow=rim.receiveShadow=true;scene.add(rim);
    const radius=.68, spacing=1.73, positions=[];
    for(let i=0;i<skills.length;i++){
      const x=(i%4-1.5)*spacing,z=(Math.floor(i/4)-1.5)*spacing;positions.push(new THREE.Vector3(x,radius-.04,z));
      const well=new THREE.Mesh(new THREE.CircleGeometry(.72,48),wellMaterial);well.rotation.x=-Math.PI/2;well.position.set(x,-.035,z);well.receiveShadow=true;scene.add(well);
      const lip=new THREE.Mesh(new THREE.TorusGeometry(.72,.045,8,48),blue);lip.rotation.x=-Math.PI/2;lip.position.set(x,-.015,z);scene.add(lip);
    }
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.ShadowMaterial({opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-.65;floor.receiveShadow=true;scene.add(floor);
    const gltf=await new GLTFLoader().parseAsync(await loadModelData(),'');
    const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});meshes.sort((a,b)=>Number(a.name.slice(0,2))-Number(b.name.slice(0,2)));
    if(meshes.length!==skills.length)throw new Error('Unexpected skill model contents.');
    const balls=meshes.map((mesh,i)=>{scene.add(mesh);mesh.scale.setScalar(radius/.028575);mesh.position.copy(positions[i]);mesh.castShadow=mesh.receiveShadow=true;return{mesh,homeRotation:mesh.quaternion.clone(),angle:0,lift:0};});
    let hovered=-1,focused=-1,pinned=-1;
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    activate=index=>{pinned=index;};
    const buttons=skills.map((skill,i)=>{
      const button=document.createElement('button');button.type='button';button.className='skill-ball-target';button.dataset.skill=i;button.setAttribute('aria-label',skill.name);button.setAttribute('aria-controls','skill-detail-content');button.setAttribute('aria-pressed',String(i===selected));
      button.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;hovered=i;pinned=-1;selectSkill(i);});
      button.addEventListener('pointerleave',()=>{if(hovered===i)hovered=-1;});
      button.addEventListener('focus',()=>{focused=i;selectSkill(i);});
      button.addEventListener('blur',()=>{if(focused===i)focused=-1;});
      button.addEventListener('click',()=>{selectSkill(i);pinned=i;});
      button.addEventListener('keydown',e=>{
        const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4}[e.key];if(!delta)return;e.preventDefault();buttons[(i+delta+skills.length)%skills.length].focus();
      });
      targets.append(button);return button;
    });
    const projected=new THREE.Vector3(),rotation=new THREE.Quaternion(),yAxis=new THREE.Vector3(0,1,0);
    function resize(){
      const w=stage.clientWidth,h=stage.clientHeight,aspect=w/h,vertical=Math.max(4.9,5.45/aspect);
      camera.left=-vertical*aspect;camera.right=vertical*aspect;camera.top=vertical;camera.bottom=-vertical;camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.setSize(w,h,false);
      const diameter=radius*2/(2*vertical)*h;
      positions.forEach((position,i)=>{
        projected.copy(position).project(camera);const button=buttons[i];button.style.left=`${(projected.x+1)*w/2}px`;button.style.top=`${(1-projected.y)*h/2}px`;button.style.width=button.style.height=`${diameter*1.15}px`;
      });
    }
    new ResizeObserver(resize).observe(stage);resize();status.hidden=true;stage.setAttribute('aria-busy','false');
    let visible=false,frame=null,previous=0;
    function animate(time){
      frame=null;if(!visible||document.hidden)return;
      const dt=previous?Math.min((time-previous)/1000,.05):0;previous=time;
      const active=hovered>=0?hovered:focused>=0?focused:pinned;
      balls.forEach((ball,i)=>{
        const target=i===active?(motion.matches?.3:.85):0;
        ball.lift=motion.matches?target:THREE.MathUtils.lerp(ball.lift,target,1-Math.exp(-10*dt));
        ball.mesh.position.y=positions[i].y+ball.lift;
        if(i===active&&!motion.matches){ball.angle+=dt*.9;rotation.setFromAxisAngle(yAxis,ball.angle);ball.mesh.quaternion.copy(rotation).multiply(ball.homeRotation);}
        else{ball.angle=0;ball.mesh.quaternion.slerp(ball.homeRotation,motion.matches?1:1-Math.exp(-8*dt));}
      });
      renderer.render(scene,camera);frame=requestAnimationFrame(animate);
    }
    function schedule(){previous=0;if(visible&&!document.hidden&&frame===null)frame=requestAnimationFrame(animate);}
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();}).observe(stage);
    document.addEventListener('visibilitychange',schedule);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();visible=false;status.hidden=false;status.textContent='Reload to restore the 3D view.';});
  }catch(error){console.error('Skill tray:',error);stage.setAttribute('aria-busy','false');status.hidden=false;status.textContent='The 3D view could not load. Use the arrows beside the skill description to explore.';}
}
if(stage){const lazy=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;lazy.disconnect();init();},{rootMargin:'200px'});lazy.observe(stage);}
