/**
 * Nidhi Tea - Dynamic Product Card Hover GSAP Animation Controller
 * Smoothly scales the card title down to 0.88
 * Lifts and gently scales the product pouch
 * Sprays/reveals the 3 companion hover elements from behind:
 *  - Top-Left: Dried Black Tea Leaves
 *  - Bottom-Left: Terracotta Clay Cup
 *  - Right-Side Top: Fresh Green Tea Leaves Sprig
 * Smoothly slides up the split Quick Buy button (Add to Cart + Price)
 */

function initNidhiCardHoverGsap() {
  if (typeof gsap === 'undefined') {
    setTimeout(initNidhiCardHoverGsap, 60);
    return;
  }

  const cards = document.querySelectorAll('.card');
  cards.forEach((card) => {
    if (card.dataset.gsapCardHoverInit === 'true') return;
    card.dataset.gsapCardHoverInit = 'true';

    const title = card.querySelector('.card__top-header .card__heading');
    const bottle = card.querySelector('.card__media .media img') || card.querySelector('.card__media img');
    const elemTL = card.querySelector('.hover-elem-tl');
    const elemBL = card.querySelector('.hover-elem-bl');
    const elemEstate = card.querySelector('.hover-elem-estate');
    const elemTR = card.querySelector('.hover-elem-tr');
    const quickAdd = card.querySelector('.card__content.for-arrow-alignment .quick-add.button-quick-add');
    const idlePrice = card.querySelector('.card__content.for-arrow-alignment .price');

    let floatTweenBL = null;
    let floatTweenEstate = null;
    let isHovered = false;

    // Set initial GSAP positions on desktop
    if (window.innerWidth >= 769) {
      if (bottle) gsap.set(bottle, { rotation: 0, scale: 1.14, y: 0 });
      if (elemTL) gsap.set(elemTL, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: -10, transformOrigin: '75% 75%' });
      if (elemBL) gsap.set(elemBL, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: -25, transformOrigin: '65% 65%' });
      // Estate is normal (hidden initially, blooms on hover)
      if (elemEstate) gsap.set(elemEstate, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: 0, transformOrigin: '25% 50%' });
      // Green tea leaves sprig is FIXED ONLY (always visible)
      if (elemTR) gsap.set(elemTR, { opacity: 1, scale: 1, x: 0, y: 0, rotation: 8, transformOrigin: '25% 75%' });
      if (quickAdd) gsap.set(quickAdd, { opacity: 0, y: 18, pointerEvents: 'none' });
    }

    card.addEventListener('mouseenter', () => {
      if (window.innerWidth >= 769) {
        isHovered = true;
        if (floatTweenBL) { floatTweenBL.kill(); floatTweenBL = null; }
        if (floatTweenEstate) { floatTweenEstate.kill(); floatTweenEstate = null; }
        gsap.killTweensOf([title, bottle, elemTL, elemBL, elemEstate, elemTR, quickAdd, idlePrice].filter(Boolean));

        if (title) gsap.to(title, { scale: 0.88, duration: 0.4, ease: 'power2.out' });
        // Product hover is more big (scale: 1.0, y: -6)
        if (bottle) gsap.to(bottle, { y: -6, scale: 1.0, rotation: 0, duration: 0.45, ease: 'power2.out' });
        if (elemTL) gsap.to(elemTL, { opacity: 1, scale: 1, x: -10, y: -4, rotation: -10, duration: 0.55, ease: 'back.out(1.8)' });

        // 1. Terracotta clay cup: blooms outward, then enters continuous hero-slider floating animation
        if (elemBL) {
          gsap.to(elemBL, {
            opacity: 1,
            scale: 1,
            x: -4,
            y: 2,
            rotation: -25,
            duration: 0.55,
            delay: 0.03,
            ease: 'back.out(1.8)',
            onComplete: () => {
              if (!isHovered) return;
              floatTweenBL = gsap.to(elemBL, {
                y: -8,
                rotation: -29,
                duration: 2.2,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1
              });
            }
          });
        }

        // 2. Tea estate medallion: blooms outward, then enters continuous hero-slider floating animation
        if (elemEstate) {
          gsap.to(elemEstate, {
            opacity: 1,
            scale: 1.04,
            x: 6,
            y: -2,
            rotation: 0,
            duration: 0.55,
            delay: 0.05,
            ease: 'power2.out',
            onComplete: () => {
              if (!isHovered) return;
              floatTweenEstate = gsap.to(elemEstate, {
                y: 8,
                rotation: 3.5,
                duration: 2.5,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1
              });
            }
          });
        }

        // Green sprig blooms gently (fixed only, no continuous float)
        if (elemTR) gsap.to(elemTR, { opacity: 1, scale: 1.06, x: 8, y: -4, rotation: 12, duration: 0.55, delay: 0.02, ease: 'back.out(1.8)' });
        if (quickAdd) gsap.to(quickAdd, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.38, ease: 'power2.out' });
        if (idlePrice) gsap.to(idlePrice, { opacity: 0, y: -6, duration: 0.25, ease: 'power2.out' });
      }
    });

    card.addEventListener('mouseleave', () => {
      if (window.innerWidth >= 769) {
        isHovered = false;
        if (floatTweenBL) { floatTweenBL.kill(); floatTweenBL = null; }
        if (floatTweenEstate) { floatTweenEstate.kill(); floatTweenEstate = null; }
        gsap.killTweensOf([title, bottle, elemTL, elemBL, elemEstate, elemTR, quickAdd, idlePrice].filter(Boolean));

        if (title) gsap.to(title, { scale: 1, duration: 0.35, ease: 'power2.inOut' });
        // Return bottle to full big size (scale: 1.14, rotation: 0)
        if (bottle) gsap.to(bottle, { y: 0, scale: 1.14, rotation: 0, duration: 0.35, ease: 'power2.inOut' });
        if (elemTL) gsap.to(elemTL, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: -10, duration: 0.3, ease: 'power2.in' });
        if (elemBL) gsap.to(elemBL, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: -25, duration: 0.3, ease: 'power2.in' });
        // Estate returns to hidden state
        if (elemEstate) gsap.to(elemEstate, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: 0, duration: 0.3, ease: 'power2.in' });
        // Green sprig returns to fixed idle visible state
        if (elemTR) gsap.to(elemTR, { opacity: 1, scale: 1, x: 0, y: 0, rotation: 8, duration: 0.35, ease: 'power2.inOut' });
        if (quickAdd) gsap.to(quickAdd, { opacity: 0, y: 18, pointerEvents: 'none', duration: 0.25, ease: 'power2.in' });
        if (idlePrice) gsap.to(idlePrice, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNidhiCardHoverGsap);
} else {
  initNidhiCardHoverGsap();
}

// Re-init on Shopify section renders and collection tab switches
document.addEventListener('shopify:section:load', initNidhiCardHoverGsap);
window.addEventListener('load', initNidhiCardHoverGsap);
document.addEventListener('click', (e) => {
  if (e.target.closest('.tablinks') || e.target.closest('.swiper-button-next') || e.target.closest('.swiper-button-prev')) {
    setTimeout(initNidhiCardHoverGsap, 200);
  }
});
