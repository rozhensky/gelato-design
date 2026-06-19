/* ============================================================
   Gelato — page behaviour
   1. GSAP masked word-reveal on scroll + ambient blob/float motion
   2. FAQ accordion (single-open)
   3. Hero "voice → product" interactive demo
   Respects prefers-reduced-motion.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- FAQ accordion: keep only one item open at a time ---
    const items = document.querySelectorAll('#faq-list details');
    items.forEach(d => d.addEventListener('toggle', () => {
        if (d.open) items.forEach(o => { if (o !== d) o.open = false; });
    }));

    if (reduce) return;
    gsap.registerPlugin(ScrollTrigger);

    // --- Masked, staggered word reveal ---
    document.querySelectorAll('.gsap-reveal').forEach(el => {
        const text = el.innerText;
        el.innerHTML = '';
        const words = text.split(' ');
        words.forEach((word, i) => {
            const wrap = document.createElement('span');
            wrap.style.display = 'inline-block';
            wrap.style.overflow = 'hidden';
            wrap.style.verticalAlign = 'bottom';
            wrap.style.paddingRight = i < words.length - 1 ? '0.25em' : '0';
            // Headroom so tall caps/diacritics aren't clipped by overflow:hidden
            // during the reveal; offset by a negative margin to keep layout stable.
            wrap.style.paddingTop = '0.15em';
            wrap.style.marginTop = '-0.15em';
            const inner = document.createElement('span');
            inner.style.display = 'inline-block';
            inner.style.transform = 'translateY(110%)';
            inner.style.transformOrigin = 'top left';
            inner.innerText = word;
            inner.className = 'reveal-word';
            wrap.appendChild(inner);
            el.appendChild(wrap);
        });
        gsap.to(el.querySelectorAll('.reveal-word'), {
            y: '0%', ease: 'power3.out', duration: 0.9, stagger: 0.04,
            scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' },
            onComplete: () => el.querySelectorAll('.reveal-word').forEach(w => {
                w.parentElement.style.overflow = 'visible';
            })
        });
    });

    // --- Ambient background motion ---
    gsap.to('.gsap-blob', { rotation: 360, scale: 1.12, x: 20, y: -20, duration: 26, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.gsap-blob-reverse', { rotation: -360, scale: 1.18, x: -28, y: 20, duration: 32, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.gsap-float > div', { y: -8, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: { each: 1, from: 'start' } });
});

// ===== Voice → Product hero demo =====
(function () {
    const stage = document.getElementById('voiceDemo');
    if (!stage) return;
    const mic = document.getElementById('vdMic');
    const timerEl = stage.querySelector('.vd-timer');
    const proc = stage.querySelector('.vd-proc');
    const voice = stage.querySelector('.vd-voice');
    const app = stage.querySelector('.vd-app');
    const replay = document.getElementById('vdReplay');
    let state = 'idle', t0, raf, recTimeout;

    function fmt(ms) { const s = Math.floor(ms / 1000); return '0:' + String(s).padStart(2, '0'); }
    function tick() { timerEl.textContent = fmt(Date.now() - t0); raf = requestAnimationFrame(tick); }

    function startRec() {
        state = 'recording'; stage.classList.add('is-recording');
        t0 = Date.now(); timerEl.textContent = '0:00'; tick();
        // auto-stop after ~3.2s so the demo always completes
        recTimeout = setTimeout(stopRec, 3200);
    }
    function stopRec() {
        if (state !== 'recording') return;
        clearTimeout(recTimeout); cancelAnimationFrame(raf);
        state = 'processing'; stage.classList.remove('is-recording');
        voice.classList.add('hidden'); proc.classList.remove('hidden');
        setTimeout(() => {
            proc.classList.add('hidden'); app.classList.remove('hidden');
            requestAnimationFrame(() => stage.classList.add('is-app'));
            replay.classList.remove('hidden'); replay.classList.add('flex');
            state = 'app';
        }, 1400);
    }
    function reset() {
        state = 'idle'; stage.classList.remove('is-app');
        app.classList.add('hidden'); proc.classList.add('hidden');
        voice.classList.remove('hidden');
        replay.classList.add('hidden'); replay.classList.remove('flex');
    }

    mic.addEventListener('click', () => { if (state === 'idle') startRec(); else if (state === 'recording') stopRec(); });
    replay.addEventListener('click', reset);

    // working mini-app interactions
    const tasks = [...app.querySelectorAll('.vd-task')];
    const bar = app.querySelector('.vd-bar');
    const count = app.querySelector('.vd-count');
    function refresh() {
        const d = tasks.filter(t => t.classList.contains('vd-done')).length;
        const pct = Math.round(d / tasks.length * 100);
        bar.style.width = pct + '%';
        if (count) count.textContent = pct + '%';
    }
    tasks.forEach(t => t.addEventListener('click', () => { t.classList.toggle('vd-done'); refresh(); }));
    refresh();
    // bottom tabs
    const tabs = [...app.querySelectorAll('.vd-tab')];
    tabs.forEach(tab => tab.addEventListener('click', () => { tabs.forEach(x => x.classList.remove('is-on')); tab.classList.add('is-on'); }));
    // add button
    const cta = app.querySelector('.vd-cta');
    cta.addEventListener('click', () => { cta.classList.add('is-tapped'); const o = cta.textContent; cta.textContent = '✓ Додано'; setTimeout(() => { cta.classList.remove('is-tapped'); cta.textContent = o; }, 1400); });
})();
