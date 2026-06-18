// =========================================================
// Bryan Chae - hero WebGL scene
// A noise-displaced "amber blob" + soft particle halo that
// reacts to the cursor and docks to a corner as you scroll.
// Plain Three.js (module) - no build step.
// =========================================================
import * as THREE from 'three';

const canvas = document.getElementById('webgl');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
    renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
    });
} catch (e) {
    // No WebGL - the page still works fine without the canvas.
    if (canvas) canvas.style.display = 'none';
    window.__sceneReady = true;
    console.warn('WebGL unavailable, skipping 3D scene:', e);
}

if (renderer) {
    const sizes = { w: window.innerWidth, h: window.innerHeight };
    renderer.setSize(sizes.w, sizes.h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // transparent - page bg shows through

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, sizes.w / sizes.h, 0.1, 100);
    camera.position.set(0, 0, 5);

    // ----- shared uniforms -----
    const uniforms = {
        uTime: { value: 0 },
        uAmp: { value: 0.22 },
        uFreq: { value: 1.15 },
        uColorA: { value: new THREE.Color('#b45309') }, // deep amber
        uColorB: { value: new THREE.Color('#f59e0b') }, // bright orange
        uColorC: { value: new THREE.Color('#fff7ed') }, // warm rim highlight
    };

    // ----- GLSL: classic 3D simplex noise (Ashima / Gustavson) -----
    const NOISE = /* glsl */`
        vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
        vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
        vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        float snoise(vec3 v){
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute(permute(permute(
                      i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            float n_ = 0.142857142857;
            vec3 ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);
            vec4 x = x_ * ns.x + ns.yyyy;
            vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
    `;

    const vertexShader = /* glsl */`
        uniform float uTime;
        uniform float uAmp;
        uniform float uFreq;
        varying float vDisp;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        ${NOISE}
        void main(){
            vec3 pos = position;
            float n1 = snoise(pos * uFreq + vec3(0.0, 0.0, uTime * 0.25));
            float n2 = snoise(pos * (uFreq * 2.1) + vec3(uTime * 0.4));
            float disp = n1 * 0.75 + n2 * 0.25;
            vDisp = disp;
            pos += normal * disp * uAmp;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            vNormalW = normalize(normalMatrix * normal);
            vViewDir = normalize(-mvPosition.xyz);
            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = /* glsl */`
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        varying float vDisp;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main(){
            float fres = pow(1.0 - max(dot(vNormalW, vViewDir), 0.0), 2.2);
            float t = clamp(vDisp * 0.5 + 0.5, 0.0, 1.0);
            vec3 base = mix(uColorA, uColorB, t);
            vec3 col = mix(base, uColorC, fres * 0.85);
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    // ----- the blob -----
    const blobGroup = new THREE.Group();
    scene.add(blobGroup);

    const geo = new THREE.IcosahedronGeometry(1.15, 64);
    const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
    });
    const blob = new THREE.Mesh(geo, mat);
    blobGroup.add(blob);

    // ----- soft particle halo -----
    function makeDotTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(217,119,6,1)');
        g.addColorStop(0.4, 'rgba(217,119,6,0.6)');
        g.addColorStop(1, 'rgba(217,119,6,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(c);
        return tex;
    }

    const PARTICLES = window.innerWidth < 768 ? 280 : 520;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PARTICLES * 3);
    const pRnd = new Float32Array(PARTICLES);
    for (let i = 0; i < PARTICLES; i++) {
        // distribute on a shell around the blob
        const r = 1.7 + Math.random() * 1.9;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pPos[i * 3 + 2] = r * Math.cos(phi);
        pRnd[i] = Math.random();
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('aRnd', new THREE.BufferAttribute(pRnd, 1));

    const pMat = new THREE.PointsMaterial({
        size: 0.075,
        map: makeDotTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
        blending: THREE.NormalBlending,
        sizeAttenuation: true,
    });
    const particles = new THREE.Points(pGeo, pMat);
    blobGroup.add(particles);

    // ----- interaction state -----
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let mouseSpeed = 0;
    let scrollT = 0; // 0 at hero top, ~1 after one viewport

    function onPointerMove(e) {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -((e.clientY / window.innerHeight) * 2 - 1);
        mouseSpeed = Math.min(mouseSpeed + Math.abs(nx - mouse.tx) + Math.abs(ny - mouse.ty), 1.2);
        mouse.tx = nx;
        mouse.ty = ny;
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (e.touches[0]) onPointerMove(e.touches[0]);
    }, { passive: true });

    function onScroll() {
        scrollT = Math.min(window.scrollY / window.innerHeight, 1);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    function onResize() {
        sizes.w = window.innerWidth;
        sizes.h = window.innerHeight;
        camera.aspect = sizes.w / sizes.h;
        camera.updateProjectionMatrix();
        renderer.setSize(sizes.w, sizes.h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    window.addEventListener('resize', onResize);

    // base placement depends on viewport: beside the copy on desktop,
    // a smaller accent lifted above the copy on mobile (keeps text legible)
    const MOBILE = () => sizes.w < 760;
    function baseX() { return MOBILE() ? 0.2 : 1.78; }
    function baseY() { return MOBILE() ? 1.95 : 0.1; }
    function baseScale() { return MOBILE() ? 0.55 : 1.0; }

    // ----- render loop -----
    const clock = new THREE.Clock();

    function lerp(a, b, t) { return a + (b - a) * t; }

    function frame() {
        const t = clock.getElapsedTime();
        uniforms.uTime.value = t;

        // ease mouse
        mouse.x = lerp(mouse.x, mouse.tx, 0.06);
        mouse.y = lerp(mouse.y, mouse.ty, 0.06);
        mouseSpeed = lerp(mouseSpeed, 0, 0.04);

        // distortion responds to cursor energy
        uniforms.uAmp.value = lerp(uniforms.uAmp.value, 0.22 + mouseSpeed * 0.45, 0.08);

        // blob rotates gently + leans toward cursor
        blobGroup.rotation.y += 0.0016;
        blobGroup.rotation.x = lerp(blobGroup.rotation.x, mouse.y * 0.35, 0.05);
        blobGroup.rotation.z = lerp(blobGroup.rotation.z, -mouse.x * 0.15, 0.05);

        // dock to top-right corner + shrink as the user scrolls past the hero
        const dock = scrollT;
        const bScale = baseScale();
        const targetScale = lerp(bScale, bScale * 0.55, dock);
        blobGroup.scale.setScalar(lerp(blobGroup.scale.x, targetScale, 0.08));

        const tx = lerp(baseX(), MOBILE() ? 2.4 : 2.7, dock) + mouse.x * 0.25;
        const ty = lerp(baseY(), MOBILE() ? 2.5 : 1.9, dock) + mouse.y * 0.25;
        blobGroup.position.x = lerp(blobGroup.position.x, tx, 0.07);
        blobGroup.position.y = lerp(blobGroup.position.y, ty, 0.07);

        // particles drift
        particles.rotation.y -= 0.0009;
        pMat.opacity = lerp(0.9, 0.35, dock);

        // subtle camera parallax
        camera.position.x = lerp(camera.position.x, mouse.x * 0.4, 0.05);
        camera.position.y = lerp(camera.position.y, mouse.y * 0.4, 0.05);
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
        if (!reduceMotion) requestAnimationFrame(frame);
    }

    // initial placement
    blobGroup.position.set(baseX(), baseY(), 0);
    blobGroup.scale.setScalar(baseScale());

    if (reduceMotion) {
        uniforms.uAmp.value = 0.18;
        renderer.render(scene, camera);
    } else {
        requestAnimationFrame(frame);
    }

    window.__sceneReady = true;
}
