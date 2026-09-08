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
    const elemTR = card.querySelector('.hover-elem-tr');
    const quickAdd = card.querySelector('.card__content.for-arrow-alignment .quick-add.button-quick-add');
    const idlePrice = card.querySelector('.card__content.for-arrow-alignment .price');

    // Set initial GSAP positions on desktop
    if (window.innerWidth >= 769) {
      if (elemTL) gsap.set(elemTL, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: 0, transformOrigin: 'center center' });
      if (elemBL) gsap.set(elemBL, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: 0, transformOrigin: 'center center' });
      if (elemTR) gsap.set(elemTR, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: 0, transformOrigin: 'center center' });
      if (quickAdd) gsap.set(quickAdd, { opacity: 0, y: 22, pointerEvents: 'none' });
    }

    card.addEventListener('mouseenter', () => {
      if (window.innerWidth >= 769) {
        gsap.killTweensOf([title, bottle, elemTL, elemBL, elemTR, quickAdd, idlePrice].filter(Boolean));
        if (title) gsap.to(title, { scale: 0.88, duration: 0.4, ease: 'power2.out' });
        if (bottle) gsap.to(bottle, { y: -16, scale: 1.08, duration: 0.45, ease: 'power2.out' });
        if (elemTL) gsap.to(elemTL, { opacity: 1, scale: 1.08, x: -18, y: -14, rotation: -16, duration: 0.55, ease: 'back.out(1.8)' });
        if (elemBL) gsap.to(elemBL, { opacity: 1, scale: 1.06, x: -14, y: 14, rotation: 10, duration: 0.55, delay: 0.04, ease: 'back.out(1.8)' });
        if (elemTR) gsap.to(elemTR, { opacity: 1, scale: 1.1, x: 18, y: -12, rotation: 18, duration: 0.55, delay: 0.08, ease: 'back.out(1.8)' });
        if (quickAdd) gsap.to(quickAdd, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.38, ease: 'power2.out' });
        if (idlePrice) gsap.to(idlePrice, { opacity: 0, y: -6, duration: 0.25, ease: 'power2.out' });
      }
    });

    card.addEventListener('mouseleave', () => {
      if (window.innerWidth >= 769) {
        gsap.killTweensOf([title, bottle, elemTL, elemBL, elemTR, quickAdd, idlePrice].filter(Boolean));
        if (title) gsap.to(title, { scale: 1, duration: 0.35, ease: 'power2.inOut' });
        if (bottle) gsap.to(bottle, { y: 0, scale: 1, duration: 0.35, ease: 'power2.inOut' });
        if (elemTL) gsap.to(elemTL, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: 0, duration: 0.3, ease: 'power2.in' });
        if (elemBL) gsap.to(elemBL, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: 0, duration: 0.3, ease: 'power2.in' });
        if (elemTR) gsap.to(elemTR, { opacity: 0, scale: 0.2, x: 0, y: 0, rotation: 0, duration: 0.3, ease: 'power2.in' });
        if (quickAdd) gsap.to(quickAdd, { opacity: 0, y: 22, pointerEvents: 'none', duration: 0.25, ease: 'power2.in' });
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
