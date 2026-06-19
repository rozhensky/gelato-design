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

// ===== Hero stages slider =====
(function () {
    const root = document.getElementById('stageSlider');
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const slides = [...root.querySelectorAll('.gs-slide')];
    const dots = [...root.querySelectorAll('.gs-dot')];
    const curEl = root.querySelector('.gs-cur');
    const prev = root.querySelector('.gs-prev');
    const next = root.querySelector('.gs-next');
    const AUTO = 10000;
    let i = 0, timer = null;

    function show(n) {
        i = (n + slides.length) % slides.length;
        slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
        dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
        if (curEl) curEl.textContent = String(i + 1).padStart(2, '0');
    }
    function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
    function startAuto() { if (reduce) return; stopAuto(); timer = setInterval(() => show(i + 1), AUTO); }
    function go(n) { show(n); startAuto(); }   // reset the timer on any manual nav

    // arrows + dots for manual nav; cards also auto-advance when idle
    if (prev) prev.addEventListener('click', () => go(i - 1));
    if (next) next.addEventListener('click', () => go(i + 1));
    dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
    root.addEventListener('mouseenter', stopAuto);
    root.addEventListener('mouseleave', startAuto);

    show(0);
    startAuto();
})();

// ===== Founder-story video modal (YouTube) =====
(function () {
    const modal = document.getElementById('vidModal');
    if (!modal) return;
    const frame = document.getElementById('vidFrame');
    const open = id => { frame.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0'; modal.classList.remove('hidden'); modal.classList.add('flex'); document.body.style.overflow = 'hidden'; };
    const close = () => { frame.src = ''; modal.classList.add('hidden'); modal.classList.remove('flex'); document.body.style.overflow = ''; };
    document.querySelectorAll('.vid-card').forEach(c => c.addEventListener('click', () => open(c.dataset.yt)));
    const btn = document.getElementById('vidClose'); if (btn) btn.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
})();


// ===== Floating CTA: hidden at top, revealed once the "Найдорожче" block is reached =====
(function () {
    var btn = document.getElementById('floatCta');
    var trigger = document.getElementById('cost-trigger');
    if (!btn || !trigger) return;
    function update() {
        var top = trigger.getBoundingClientRect().top;
        if (top < window.innerHeight * 0.7) btn.classList.add('cta-show');
        else btn.classList.remove('cta-show');
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
})();


// ===== Cost table: hide the "swipe" hint once scrolled / if it fits =====
(function () {
    var sc = document.getElementById('costScroll');
    var hint = document.getElementById('costScrollHint');
    if (!sc || !hint) return;
    sc.addEventListener('scroll', function () { if (sc.scrollLeft > 8) hint.classList.add('opacity-0'); }, { passive: true });
    function check() { if (sc.scrollWidth <= sc.clientWidth + 4) hint.classList.add('opacity-0'); }
    window.addEventListener('resize', check);
    check();
})();
