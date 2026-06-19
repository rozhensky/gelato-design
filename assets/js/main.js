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
    const slides = [...root.querySelectorAll('.gs-slide')];
    const dots = [...root.querySelectorAll('.gs-dot')];
    const curEl = root.querySelector('.gs-cur');
    const prev = root.querySelector('.gs-prev');
    const next = root.querySelector('.gs-next');
    let i = 0;

    function show(n) {
        i = (n + slides.length) % slides.length;
        slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
        dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
        if (curEl) curEl.textContent = String(i + 1).padStart(2, '0');
    }

    // manual navigation only — no auto-advance
    prev.addEventListener('click', () => show(i - 1));
    next.addEventListener('click', () => show(i + 1));
    dots.forEach((d, k) => d.addEventListener('click', () => show(k)));

    show(0);
})();
