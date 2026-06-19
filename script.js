// =========================================================
// Bryan Chae - interactions
// Lenis smooth scroll · GSAP ScrollTrigger reveals · custom
// cursor · magnetic buttons · nav indicator · loader
// =========================================================
(function () {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = window.matchMedia('(hover: none)').matches;
    const hasGSAP = typeof window.gsap !== 'undefined';
    const hasLenis = typeof window.Lenis !== 'undefined';

    if (hasGSAP && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
    }

    /* ---------------------------------------------------------
       Smooth scroll (Lenis) wired into GSAP's ticker
       --------------------------------------------------------- */
    let lenis = null;
    if (hasLenis && !reduce) {
        lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
        if (hasGSAP && window.ScrollTrigger) {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
        } else {
            const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
            requestAnimationFrame(raf);
        }
    }

    function scrollTo(target) {
        const el = document.querySelector(target);
        if (!el) return;
        if (lenis) lenis.scrollTo(el, { offset: -10 });
        else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }

    // anchor links → smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
            const href = a.getAttribute('href');
            if (href.length > 1) {
                e.preventDefault();
                scrollTo(href);
            }
        });
    });

    /* ---------------------------------------------------------
       Loader
       --------------------------------------------------------- */
    const loader = document.getElementById('loader');
    const loaderPct = document.getElementById('loaderPct');
    const loaderLog = document.getElementById('loaderLog');
    const loaderHint = document.getElementById('loaderHint');
    const loaderBlocks = document.getElementById('loaderBlocks');

    // build the segmented "health bar"
    const BLOCK_COUNT = 16;
    if (loaderBlocks) {
        for (let i = 0; i < BLOCK_COUNT; i++) {
            const b = document.createElement('span');
            b.className = 'blk';
            loaderBlocks.appendChild(b);
        }
    }
    const blocks = loaderBlocks ? Array.from(loaderBlocks.children) : [];

    // boot log lines, revealed as the bar passes each threshold
    const BOOT = [
        { at: 4, html: '&gt; boot portfolio_os' },
        { at: 20, html: '&gt; mounting webgl renderer ......... <span class="ok">[ OK ]</span>' },
        { at: 38, html: '&gt; compiling blob shaders .......... <span class="ok">[ OK ]</span>' },
        { at: 56, html: '&gt; loading experience modules ...... <span class="ok">[ OK ]</span>' },
        { at: 74, html: '&gt; indexing projects ............... <span class="ok">[ OK ]</span>' },
        { at: 90, html: '&gt; calibrating cursor .............. <span class="ok">[ OK ]</span>' },
    ];
    let bootShown = 0;

    function pushLog(html, cls) {
        if (!loaderLog) return;
        const d = document.createElement('div');
        d.className = 'line' + (cls ? ' ' + cls : '');
        d.innerHTML = html;
        loaderLog.appendChild(d);
    }

    function updateLoader(p) {
        const pct = Math.max(0, Math.min(100, Math.floor(p)));
        if (loaderPct) loaderPct.textContent = String(pct).padStart(2, '0') + '%';
        const lit = Math.round((pct / 100) * BLOCK_COUNT);
        for (let i = 0; i < blocks.length; i++) blocks[i].classList.toggle('on', i < lit);
        while (bootShown < BOOT.length && pct >= BOOT[bootShown].at) {
            pushLog(BOOT[bootShown].html);
            bootShown++;
        }
    }

    function revealHero() {
        if (!hasGSAP) return;
        const words = document.querySelectorAll('.hero-title .word');
        // fromTo so GSAP fully owns the transform: it would otherwise parse the
        // CSS translateY(120%) into a stray pixel `y`, leaving words offset.
        gsap.fromTo(words,
            { yPercent: 120, y: 0 },
            { yPercent: 0, y: 0, duration: 1, ease: 'power4.out', stagger: 0.06, delay: 0.05 }
        );
        gsap.to('.hero .reveal-up', {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.08,
            delay: 0.35,
        });
    }

    // wipe the boot screen and drop the visitor into the site
    let entered = false;
    function enterSite() {
        if (entered) return;
        entered = true;
        document.removeEventListener('keydown', onStartKey);
        if (loader) {
            loader.removeEventListener('click', enterSite);
            loader.removeEventListener('touchstart', enterSite);
            loader.classList.add('done');
        }
        document.body.classList.add('loaded');
        if (reduce) {
            document.querySelectorAll('.hero-title .word').forEach((w) => (w.style.transform = 'none'));
            document.querySelectorAll('.reveal-up').forEach((el) => {
                el.style.opacity = 1;
                el.style.transform = 'none';
            });
        } else {
            revealHero();
        }
    }
    function onStartKey() { enterSite(); }

    // boot complete -> show READY and wait for the player to press start
    let ready = false;
    function reachReady() {
        if (ready) return;
        ready = true;
        updateLoader(100);
        while (bootShown < BOOT.length) { pushLog(BOOT[bootShown].html); bootShown++; }
        pushLog('&gt; <span class="ready">READY</span>');
        if (loaderHint) {
            loaderHint.innerHTML = '▶ PRESS START';
            loaderHint.classList.add('ready');
            loaderHint.setAttribute('role', 'button');
            loaderHint.setAttribute('tabindex', '0');
            loaderHint.setAttribute('aria-label', 'Press start to enter the site');
            try { loaderHint.focus(); } catch (e) { /* noop */ }
        }
        if (loader) loader.classList.add('ready');
        // any key, click, or tap enters the site
        document.addEventListener('keydown', onStartKey);
        if (loader) {
            loader.addEventListener('click', enterSite);
            loader.addEventListener('touchstart', enterSite, { passive: true });
        }
    }

    // determinate progress, deliberately paced so the boot feels real
    let prog = 0;
    let loaded = false;
    const MIN_BOOT_MS = 3200;
    const bootStart = performance.now();
    const progTimer = setInterval(() => {
        const elapsed = performance.now() - bootStart;
        const ceiling = (loaded && elapsed >= MIN_BOOT_MS) ? 100 : 92;
        prog = Math.min(prog + Math.random() * 4 + 1.5, ceiling);
        updateLoader(prog);
        if (prog >= 100) { clearInterval(progTimer); reachReady(); }
    }, 150);

    window.addEventListener('load', () => { loaded = true; });
    // safety: if an asset stalls, still reach the start prompt
    setTimeout(() => {
        loaded = true;
        if (!ready) { clearInterval(progTimer); reachReady(); }
    }, 9000);

    /* ---------------------------------------------------------
       Scroll-reveal for content (not the hero, handled above)
       --------------------------------------------------------- */
    if (hasGSAP && window.ScrollTrigger && !reduce) {
        gsap.utils.toArray('.section .reveal-up').forEach((el) => {
            gsap.to(el, {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: 'power3.out',
                scrollTrigger: { trigger: el, start: 'top 88%' },
            });
        });
    } else if (!hasGSAP) {
        document.querySelectorAll('.reveal-up').forEach((el) => {
            el.style.opacity = 1;
            el.style.transform = 'none';
        });
    }

    /* ---------------------------------------------------------
       Scroll progress rail
       --------------------------------------------------------- */
    const rail = document.getElementById('scrollRail');
    function updateRail() {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        const p = h > 0 ? (window.scrollY / h) * 100 : 0;
        if (rail) rail.style.width = p + '%';
    }
    window.addEventListener('scroll', updateRail, { passive: true });
    updateRail();

    /* ---------------------------------------------------------
       Header: hide on scroll down, show on scroll up
       --------------------------------------------------------- */
    const header = document.querySelector('.site-header');
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (header) {
            if (y > lastY && y > 200) header.classList.add('hide');
            else header.classList.remove('hide');
        }
        lastY = y;
    }, { passive: true });

    /* ---------------------------------------------------------
       Nav pill indicator + active section tracking
       --------------------------------------------------------- */
    document.fonts.ready.then(() => {
        const box = document.querySelector('.nav-tabs-box');
        const links = Array.from(document.querySelectorAll('.nav-link'));
        if (!box || !links.length) return;

        const indicator = document.createElement('div');
        indicator.classList.add('nav-indicator');
        box.appendChild(indicator);

        function moveTo(link) {
            const boxRect = box.getBoundingClientRect();
            const r = link.getBoundingClientRect();
            const bl = parseFloat(getComputedStyle(box).borderLeftWidth) || 0;
            indicator.style.left = (r.left - boxRect.left - bl) + 'px';
            indicator.style.width = r.width + 'px';
        }

        function setActive(link) {
            links.forEach((l) => l.classList.remove('active'));
            if (link) {
                link.classList.add('active');
                moveTo(link);
                indicator.style.opacity = 1;
            } else {
                indicator.style.opacity = 0;
            }
        }

        requestAnimationFrame(() => requestAnimationFrame(() => indicator.classList.add('ready')));

        // hover preview
        links.forEach((l) => {
            l.addEventListener('mouseenter', () => moveTo(l));
            l.addEventListener('mouseleave', () => {
                const cur = document.querySelector('.nav-link.active');
                if (cur) moveTo(cur);
                else indicator.style.opacity = 0;
            });
        });

        // active section via ScrollTrigger
        if (hasGSAP && window.ScrollTrigger) {
            links.forEach((link) => {
                const sel = link.getAttribute('href');
                const sec = document.querySelector(sel);
                if (!sec) return;
                ScrollTrigger.create({
                    trigger: sec,
                    start: 'top 55%',
                    end: 'bottom 55%',
                    onToggle: (self) => { if (self.isActive) setActive(link); },
                });
            });
            // clear when back at hero
            const hero = document.getElementById('hero');
            if (hero) ScrollTrigger.create({
                trigger: hero,
                start: 'top 40%',
                end: 'bottom 55%',
                onToggle: (self) => { if (self.isActive) setActive(null); },
            });
        }
        window.addEventListener('resize', () => {
            const cur = document.querySelector('.nav-link.active');
            if (cur) moveTo(cur);
        });
    });

    /* ---------------------------------------------------------
       Custom cursor
       --------------------------------------------------------- */
    if (!isTouch) {
        const cursor = document.getElementById('cursor');
        const dot = cursor && cursor.querySelector('.cursor-dot');
        const ring = cursor && cursor.querySelector('.cursor-ring');
        if (cursor && dot && ring) {
            const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            const ringPos = { x: pos.x, y: pos.y };
            let shown = false;

            window.addEventListener('mousemove', (e) => {
                pos.x = e.clientX;
                pos.y = e.clientY;
                dot.style.left = pos.x + 'px';
                dot.style.top = pos.y + 'px';
                if (!shown) { cursor.classList.add('ready'); shown = true; }
            });

            function ringLoop() {
                ringPos.x += (pos.x - ringPos.x) * 0.18;
                ringPos.y += (pos.y - ringPos.y) * 0.18;
                ring.style.left = ringPos.x + 'px';
                ring.style.top = ringPos.y + 'px';
                requestAnimationFrame(ringLoop);
            }
            requestAnimationFrame(ringLoop);

            document.querySelectorAll('[data-cursor]').forEach((el) => {
                const type = el.getAttribute('data-cursor');
                el.addEventListener('mouseenter', () => {
                    cursor.classList.toggle('is-hover', type === 'hover');
                    cursor.classList.toggle('is-view', type === 'view');
                });
                el.addEventListener('mouseleave', () => {
                    cursor.classList.remove('is-hover', 'is-view');
                });
            });
        }
    }

    /* ---------------------------------------------------------
       Magnetic buttons
       --------------------------------------------------------- */
    if (!isTouch && !reduce) {
        document.querySelectorAll('.magnetic').forEach((el) => {
            const strength = 0.4;
            el.addEventListener('mousemove', (e) => {
                const r = el.getBoundingClientRect();
                const mx = e.clientX - (r.left + r.width / 2);
                const my = e.clientY - (r.top + r.height / 2);
                el.style.transform = `translate(${mx * strength}px, ${my * strength}px)`;
            });
            el.addEventListener('mouseleave', () => {
                el.style.transform = 'translate(0, 0)';
            });
        });
    }

    /* ---------------------------------------------------------
       Cursor-reactive skill tags (spring away from the cursor)
       --------------------------------------------------------- */
    if (!isTouch && !reduce) {
        const tagWrap = document.querySelector('.skill-tags');
        if (tagWrap) {
            const tags = Array.from(tagWrap.querySelectorAll('span'));
            const st = tags.map(() => ({ x: 0, y: 0 }));
            const RADIUS = 150;
            const MAX_PUSH = 62;
            const mouse = { x: -9999, y: -9999 };
            let raf = null;

            window.addEventListener('pointermove', (e) => {
                mouse.x = e.clientX;
                mouse.y = e.clientY;
            }, { passive: true });

            function loop() {
                for (let i = 0; i < tags.length; i++) {
                    const r = tags[i].getBoundingClientRect();
                    // rest center (back out the offset we applied) keeps the force stable
                    const cx = r.left + r.width / 2 - st[i].x;
                    const cy = r.top + r.height / 2 - st[i].y;
                    const dx = cx - mouse.x;
                    const dy = cy - mouse.y;
                    const dist = Math.hypot(dx, dy);
                    let tx = 0, ty = 0, force = 0;
                    if (dist < RADIUS && dist > 0.01) {
                        force = 1 - dist / RADIUS;
                        const push = force * MAX_PUSH;
                        tx = (dx / dist) * push;
                        ty = (dy / dist) * push;
                    }
                    st[i].x += (tx - st[i].x) * 0.15;   // spring ease
                    st[i].y += (ty - st[i].y) * 0.15;
                    tags[i].style.transform = `translate(${st[i].x.toFixed(2)}px, ${st[i].y.toFixed(2)}px)`;
                    tags[i].classList.toggle('near', force > 0.12);
                }
                raf = requestAnimationFrame(loop);
            }

            // only run the loop while the skills section is on screen
            const io = new IntersectionObserver((entries) => {
                entries.forEach((en) => {
                    if (en.isIntersecting && !raf) {
                        raf = requestAnimationFrame(loop);
                    } else if (!en.isIntersecting && raf) {
                        cancelAnimationFrame(raf);
                        raf = null;
                        st.forEach((s, i) => { s.x = 0; s.y = 0; tags[i].style.transform = ''; tags[i].classList.remove('near'); });
                    }
                });
            }, { threshold: 0 });
            io.observe(tagWrap);
        }
    }

    /* ---------------------------------------------------------
       Back to top
       --------------------------------------------------------- */
    const backToTop = document.getElementById('backToTop');
    if (backToTop) {
        backToTop.addEventListener('click', () => {
            if (lenis) lenis.scrollTo(0);
            else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        });
    }
})();
