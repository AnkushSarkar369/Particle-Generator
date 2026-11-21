'use strict';
/* ---------- Three.js scene ---------- */
const Scene = (function () {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  // Cap backing resolution: high-DPI rendering is disproportionately expensive on older iGPUs.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setClearColor(0x03040a, 1);

  // WebGL diagnostics: VA-API (video decode/encode) is separate from 3D rendering.
  const gpuEl = document.getElementById('gpu');
  if (gpuEl) {
    try {
      const gl = renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const gpuVendor = gl.getParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR);
      const gpuName = gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
      const rendererName = [gpuVendor, gpuName].filter(Boolean).join(' · ') || 'WebGL renderer (details hidden)';
      const software = /llvmpipe|softpipe|swiftshader|software rasterizer|swr/i.test(rendererName);
      gpuEl.textContent = (software ? 'SOFTWARE · ' : 'GPU · ') + rendererName;
      gpuEl.title = `WebGL renderer: ${rendererName}. ${software ? 'This is software rendering, not the Intel GPU.' : 'Rendering is handled by the browser WebGL graphics driver.'}`;
      gpuEl.classList.toggle('software', software);
    } catch (error) {
      gpuEl.textContent = 'GPU · WebGL renderer details unavailable';
      gpuEl.title = String(error);
    }
  }
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03040a, 0.02);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  camera.position.set(0, 2.2, 9);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.enablePan = false; controls.minDistance = 3.5; controls.maxDistance = 30;

  const PX = renderer.getPixelRatio();
  const U = {
    uTime: { value: 0 }, uMass: { value: 0 }, uEnergy: { value: 0 }, uSpin: { value: 0 },
    uQ: { value: 0 }, uColor: { value: new THREE.Color(0xc9b8ff) }, uChargeColor: { value: new THREE.Color(0xbfc8ff) },
    uPx: { value: PX }
  };

  const GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
 const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
 vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
 vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
 i=mod289(i);
 vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
 float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
 vec4 j=p-49.*floor(p*ns.z*ns.z);
 vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
 vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
 vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
 vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
 p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
 vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
 return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
mat3 rotAxis(vec3 a,float ang){
 a=normalize(a); float s=sin(ang),c=cos(ang),oc=1.-c;
 return mat3(oc*a.x*a.x+c, oc*a.x*a.y+a.z*s, oc*a.z*a.x-a.y*s,
             oc*a.x*a.y-a.z*s, oc*a.y*a.y+c, oc*a.y*a.z+a.x*s,
             oc*a.z*a.x+a.y*s, oc*a.y*a.z-a.x*s, oc*a.z*a.z+c);
}
// spin 0: no rotation (radial breathing elsewhere). spin 1/2: precessing axis, half-rate. spin 1: fixed axis with helical twist.
vec3 spinRot(vec3 p,float t,float spin,float en){
 float wH=clamp(1.-abs(spin-.5)*2.,0.,1.);
 float wO=clamp((spin-.5)*2.,0.,1.);
 float w=0.6+en*3.0;
 vec3 axH=vec3(sin(t*0.35)*0.6,1.0,cos(t*0.35)*0.6);
 p=rotAxis(axH,t*w*0.5*wH)*p;
 p=rotAxis(vec3(0.,1.,0.),(t*w+p.y*1.4)*wO)*p;
 return p;
}
vec3 spinXform(vec3 p,float t,float spin,float en,float seed){
 float wZ=1.-clamp(spin*2.,0.,1.);
 float wO=clamp((spin-.5)*2.,0.,1.);
 p=spinRot(p,t,spin,en);
 p.y*=1.-0.45*wO;
 p*=1.+wZ*0.10*sin(t*(0.6+en*3.)*1.5+seed*6.2831);
 return p;
}
`;

  const mkMat = (vs, fs, extra) => new THREE.ShaderMaterial(Object.assign({
    vertexShader: GLSL + vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }, extra));

  /* --- core --- */
  const coreMat = mkMat(`
uniform float uTime,uMass,uEnergy,uSpin;
varying vec3 vN; varying vec3 vV; varying float vD;
void main(){
 vec3 q=spinRot(position,uTime,uSpin,uEnergy);
 float speed=0.35+uEnergy*2.6; float freq=1.3+uEnergy*3.2;
 float amp=mix(0.42,0.06,pow(uMass,0.5))+uEnergy*0.10;
 float n=snoise(q*freq+vec3(0.,0.,uTime*speed))*0.6+snoise(q*freq*2.1-vec3(uTime*speed*1.3))*0.25;
 float r=mix(1.0,0.72,uMass);
 vec3 pos=normalize(position)*(r+n*amp);
 vD=n;
 vec4 mv=modelViewMatrix*vec4(pos,1.);
 vN=normalize(normalMatrix*normalize(position));
 vV=-mv.xyz;
 gl_Position=projectionMatrix*mv;
}`, `
uniform vec3 uColor; uniform float uMass,uEnergy;
varying vec3 vN; varying vec3 vV; varying float vD;
void main(){
 vec3 N=normalize(vN),V=normalize(vV);
 float f=pow(1.-max(dot(N,V),0.),2.2);
 float dens=mix(0.55,1.6,pow(uMass,.6));
 vec3 col=uColor*(0.35*dens+(0.9+uEnergy*1.4)*f)+vec3(1.)*pow(f,5.)*0.5+uColor*vD*0.25;
 gl_FragColor=vec4(col,0.9);
}`, { uniforms: { uTime: U.uTime, uMass: U.uMass, uEnergy: U.uEnergy, uSpin: U.uSpin, uColor: U.uColor } });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 12), coreMat);

  /* --- orbiting cloud (ring for spin>0, shell for spin 0) --- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const N = 3200;
  const cPos = new Float32Array(N * 3), cSph = new Float32Array(N * 3), cAng = new Float32Array(N), cSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = rnd(0, Math.PI * 2), rr = 1.5 + Math.abs(gauss()) * 0.9 + rnd(0, 0.25);
    cPos.set([Math.cos(a) * rr, gauss() * 0.14 * (rr / 1.5), Math.sin(a) * rr], i * 3);
    const u = rnd(-1, 1), t = rnd(0, Math.PI * 2), sq = Math.sqrt(1 - u * u), R = rnd(1.4, 2.6);
    cSph.set([sq * Math.cos(t) * R, u * R, sq * Math.sin(t) * R], i * 3);
    cAng[i] = a; cSeed[i] = Math.random();
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cg.setAttribute('aSph', new THREE.BufferAttribute(cSph, 3));
  cg.setAttribute('aAng', new THREE.BufferAttribute(cAng, 1));
  cg.setAttribute('aSeed', new THREE.BufferAttribute(cSeed, 1));
  const cloudMat = mkMat(`
attribute vec3 aSph; attribute float aAng,aSeed;
uniform float uTime,uMass,uEnergy,uSpin,uPx;
varying float vTw;
void main(){
 float n=uSpin*2.;
 float m=0.32*cos(n*aAng)*clamp(n,0.,1.);
 vec3 ring=vec3(position.x*(1.+m),position.y,position.z*(1.+m));
 float wZ=1.-clamp(uSpin*2.,0.,1.);
 vec3 p=mix(ring,aSph,wZ);
 p=spinXform(p,uTime,uSpin,uEnergy,aSeed);
 float len=length(p);
 float spd=0.8+uEnergy*5.; float fr=2.5+uEnergy*6.;
 p*=1.+0.07*(0.5+uEnergy)*sin(len*fr-uTime*spd);
 p*=mix(1.,0.62,uMass);
 vec4 mv=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*mv;
 gl_PointSize=(2.2+uEnergy*2.2+aSeed*1.2)*uPx*(8./-mv.z);
 vTw=0.6+0.4*sin(uTime*(1.+aSeed*3.)+aSeed*40.);
}`, `
uniform vec3 uColor; uniform float uEnergy; varying float vTw;
void main(){
 float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); a*=a;
 gl_FragColor=vec4(uColor*(0.8+uEnergy*1.5)*vTw,a*0.9);
}`, { uniforms: { uTime: U.uTime, uMass: U.uMass, uEnergy: U.uEnergy, uSpin: U.uSpin, uPx: U.uPx, uColor: U.uColor } });
  const cloud = new THREE.Points(cg, cloudMat);
  cloud.frustumCulled = false;

  /* --- electric field lines (flow out for +, in for -; count scales with |q|) --- */
  const L = 16, K = 32, FN = L * K;
  const fDir = new Float32Array(FN * 3), fPh = new Float32Array(FN), fRank = new Float32Array(FN), fPos = new Float32Array(FN * 3);
  for (let l = 0; l < L; l++) {
    const y = 1 - (l + 0.5) / L * 2, rad = Math.sqrt(1 - y * y), th = l * 2.399963;
    for (let k = 0; k < K; k++) {
      const i = l * K + k;
      fDir.set([Math.cos(th) * rad, y, Math.sin(th) * rad], i * 3);
      fPh[i] = k / K + Math.random() * 0.01; fRank[i] = l / L;
    }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fg.setAttribute('aDir', new THREE.BufferAttribute(fDir, 3));
  fg.setAttribute('aPh', new THREE.BufferAttribute(fPh, 1));
  fg.setAttribute('aRank', new THREE.BufferAttribute(fRank, 1));
  const fieldMat = mkMat(`
attribute vec3 aDir; attribute float aPh,aRank;
uniform float uTime,uQ,uEnergy,uPx; varying float vA;
void main(){
 float sgn=uQ>=0.?1.:-1.;
 float prog=fract(aPh+sgn*uTime*(0.12+uEnergy*0.2));
 float r=1.15+prog*3.4;
 float vis=step(aRank,abs(uQ)+0.0001)*step(0.001,abs(uQ));
 vA=vis*smoothstep(0.,.12,prog)*(1.-prog);
 vec4 mv=modelViewMatrix*vec4(aDir*r,1.);
 gl_Position=projectionMatrix*mv;
 gl_PointSize=2.6*uPx*(8./-mv.z);
}`, `
uniform vec3 uChargeColor; varying float vA;
void main(){
 float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d);
 gl_FragColor=vec4(uChargeColor*1.6,a*vA);
}`, { uniforms: { uTime: U.uTime, uQ: U.uQ, uEnergy: U.uEnergy, uPx: U.uPx, uChargeColor: U.uChargeColor } });
  const field = new THREE.Points(fg, fieldMat);
  field.frustumCulled = false;

  /* --- aura sprite --- */
  const ac = document.createElement('canvas'); ac.width = ac.height = 128;
  const ax = ac.getContext('2d'), grd = ax.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,.9)'); grd.addColorStop(0.35, 'rgba(255,255,255,.25)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  ax.fillStyle = grd; ax.fillRect(0, 0, 128, 128);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(ac), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));

  const group = new THREE.Group();
  group.add(core, cloud, field, aura);
  scene.add(group);

  /* --- gravity grid: pit depth follows mass; ripples follow energy --- */
  const GN = 32, GS = 64, GE = 7;
  const gp = [];
  for (let i = 0; i <= GN; i++) {
    const a = -GE + 2 * GE * i / GN;
    for (let j = 0; j < GS; j++) {
      const b0 = -GE + 2 * GE * j / GS, b1 = -GE + 2 * GE * (j + 1) / GS;
      gp.push(a, 0, b0, a, 0, b1);   // line along z
      gp.push(b0, 0, a, b1, 0, a);   // line along x
    }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  const gridMat = mkMat(`
uniform float uTime,uMass,uEnergy; varying float vF;
void main(){
 vec3 p=position; float r=length(p.xz);
 float depth=uMass;
 p.y=-2.3-depth*3.2/sqrt(1.+r*r*1.2);
 p.y+=uEnergy*0.12*sin(r*3.-uTime*(1.+uEnergy*4.))*exp(-r*0.25);
 vF=exp(-r*0.16);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`, `
uniform vec3 uColor; varying float vF;
void main(){ gl_FragColor=vec4(mix(vec3(0.25,0.6,0.9),uColor,0.4),vF*0.5); }`,
  { uniforms: { uTime: U.uTime, uMass: U.uMass, uEnergy: U.uEnergy, uColor: U.uColor } });
  const grid = new THREE.LineSegments(gg, gridMat);
  grid.frustumCulled = false;
  scene.add(grid);

  /* --- starfield --- */
  const sp = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    const u = rnd(-1, 1), t = rnd(0, Math.PI * 2), sq = Math.sqrt(1 - u * u), R = rnd(60, 110);
    sp.set([sq * Math.cos(t) * R, u * R, sq * Math.sin(t) * R], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.2, sizeAttenuation: false, color: 0x8899cc, transparent: true, opacity: 0.45, fog: false })));

  /* --- targets & smoothing --- */
  const T = { mass: 0, energy: 0, spin: 0, q: 0, color: new THREE.Color(0xc9b8ff), charge: new THREE.Color(0xbfc8ff), sx: 1, aura: 0.3 };
  function set(o) {
    T.mass = o.mass01; T.energy = o.energy01; T.spin = o.spin; T.q = o.qt / 3;
    T.color.setHex(o.colorHex); T.charge.setHex(o.chargeHex);
    T.sx = Math.max(0.1, 1 / o.gamma);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  const fpsEl = document.getElementById('fps');
  let frames = 0, acc = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const k = 1 - Math.exp(-dt * 6);
    U.uTime.value += dt;
    U.uMass.value += (T.mass - U.uMass.value) * k;
    U.uEnergy.value += (T.energy - U.uEnergy.value) * k;
    U.uSpin.value += (T.spin - U.uSpin.value) * k;
    U.uQ.value += (T.q - U.uQ.value) * k;
    U.uColor.value.lerp(T.color, k);
    U.uChargeColor.value.lerp(T.charge, k);
    group.scale.x += (T.sx - group.scale.x) * k;
    const auraS = 3.2 + U.uEnergy.value * 2.4 + U.uMass.value * 0.6;
    aura.scale.set(auraS, auraS, 1);
    aura.material.color.copy(U.uColor.value);
    aura.material.opacity = 0.22 + U.uEnergy.value * 0.5;
    controls.update();
    renderer.render(scene, camera);
    frames++; acc += dt;
    if (acc >= 0.5) { fpsEl.textContent = Math.round(frames / acc) + ' fps'; frames = 0; acc = 0; }
  }
  frame();
  return { set };
})();
