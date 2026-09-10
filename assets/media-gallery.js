if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        liveRegion: this.querySelector('[id^="GalleryStatus"]'),
        viewer: this.querySelector('[id^="GalleryViewer"]'),
        thumbnails: this.querySelector('[id^="GalleryThumbnails"]')
      };
      this.mql = window.matchMedia('(min-width: 750px)');
      this.lastActiveSlide = null;
      this.initSliderNavigation();

      if (!this.elements.thumbnails) return;
      this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
      this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
        mediaToSwitch.querySelector('button').addEventListener('click', this.setActiveMedia.bind(this, mediaToSwitch.dataset.target, false));
      });
      if (this.dataset.desktopLayout !== 'stacked' && this.mql.matches) this.removeListSemantic();
    }

    onSlideChanged(event) {
      const thumbnail = this.elements.thumbnails.querySelector(`[data-target="${event.detail.currentElement.dataset.mediaId}"]`);
      this.setActiveThumbnail(thumbnail);
    }

    setActiveMedia(mediaId, prepend) {
      const activeMedia = this.elements.viewer.querySelector(`li.product__media-item[data-media-id="${mediaId}"]`) || this.elements.viewer.querySelector(`[data-media-id="${mediaId}"]`);
      if (!activeMedia) return;

      const slides = Array.from(this.elements.viewer.querySelectorAll('li.product__media-item[data-media-id]'));
      slides.forEach((element) => {
        element.classList.remove('is-active');
      });
      activeMedia.classList.add('is-active');

      const list = this.elements.viewer ? this.elements.viewer.querySelector('ul.product__media-list') : null;
      if (list && activeMedia.dataset.colorIndex !== undefined) {
        list.setAttribute('data-active-color', activeMedia.dataset.colorIndex);
      }

      if (prepend) {
        activeMedia.parentElement.prepend(activeMedia);
        if (this.elements.thumbnails) {
          const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
          if (activeThumbnail && activeThumbnail.parentElement) {
            activeThumbnail.parentElement.prepend(activeThumbnail);
          }
        }
        if (this.elements.viewer.slider) this.elements.viewer.resetPages();
      }

      this.preventStickyHeader();
      if (this.mql.matches) {
        window.setTimeout(() => {
          if (this.elements.thumbnails) {
            activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
          }
        });
      }
      this.playActiveMedia(activeMedia);

      if (!this.elements.thumbnails) return;
      const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
      if (activeThumbnail) {
        this.setActiveThumbnail(activeThumbnail);
        if (activeThumbnail.dataset && activeThumbnail.dataset.mediaPosition) {
          this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
        }
      }
    }

    setActiveThumbnail(thumbnail) {
      if (!this.elements.thumbnails || !thumbnail) return;

      this.elements.thumbnails.querySelectorAll('button').forEach((element) => element.removeAttribute('aria-current'));
      thumbnail.querySelector('button').setAttribute('aria-current', true);
      if (this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;

      this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
    }

    announceLiveRegion(activeItem, position) {
      const image = activeItem.querySelector('.product__modal-opener--image img');
      if (!image) return;
      image.onload = () => {
        this.elements.liveRegion.setAttribute('aria-hidden', false);
        this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace(
          '[index]',
          position
        );
        setTimeout(() => {
          this.elements.liveRegion.setAttribute('aria-hidden', true);
        }, 2000);
      };
      image.src = image.src;
    }

    playActiveMedia(activeItem) {
      window.pauseAllMedia();
      const deferredMedia = activeItem.querySelector('.deferred-media');
      if (deferredMedia) deferredMedia.loadContent(false);
    }

    preventStickyHeader() {
      this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
      if (!this.stickyHeader) return;
      this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
    }

    removeListSemantic() {
      if (!this.elements.viewer.slider) return;
      this.elements.viewer.slider.setAttribute('role', 'presentation');
      this.elements.viewer.sliderItems.forEach(slide => slide.setAttribute('role', 'presentation'));
    }

    animateBotanicalsPopup() {
      if (typeof gsap === 'undefined') return;
      const botanicals = this.querySelectorAll('.pdp-botanical-item');
      if (!botanicals.length) return;

      gsap.fromTo(botanicals,
        {
          scale: 0.52,
          opacity: 0.35,
          rotation: (i) => (i % 2 === 0 ? -12 : 12)
        },
        {
          scale: 1,
          opacity: 1,
          rotation: 0,
          duration: 0.72,
          ease: 'back.out(2.2)',
          stagger: 0.035,
          overwrite: 'auto'
        }
      );
    }

    initSliderNavigation() {
      const prevBtn = this.querySelector('[data-pdp-nav="prev"]');
      const nextBtn = this.querySelector('[data-pdp-nav="next"]');
      const list = this.elements.viewer ? this.elements.viewer.querySelector('ul.product__media-list') : null;
      if (!list) return;

      const initialActive = list.querySelector('li.product__media-item.is-active') || list.querySelector('li.product__media-item');
      if (initialActive) {
        initialActive.classList.add('is-active');
        this.lastActiveSlide = initialActive;
        if (initialActive.dataset.colorIndex !== undefined) {
          list.setAttribute('data-active-color', initialActive.dataset.colorIndex);
        }
      }

      // Prev & Next Buttons (Desktop)
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (window.innerWidth >= 750) {
            this.stepMediaDesktop(-1);
          } else {
            this.stepMediaMobile(-1);
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (window.innerWidth >= 750) {
            this.stepMediaDesktop(1);
          } else {
            this.stepMediaMobile(1);
          }
        });
      }

      // Mobile Tap-to-Center on Peek Cards
      const slides = Array.from(list.querySelectorAll('li.product__media-item'));
      slides.forEach((slide, idx) => {
        slide.addEventListener('click', (e) => {
          if (window.innerWidth >= 750) return;
          if (!slide.classList.contains('is-active')) {
            e.preventDefault();
            this.scrollToMobileSlide(idx);
          }
        });
      });

      // Mobile GSAP Smooth Mouse Drag & Touch Momentum
      let isMouseDown = false;
      let startMouseX = 0;
      let startScrollLeft = 0;
      let hasDragged = false;
      let dragVelocity = 0;
      let lastDragX = 0;
      let lastDragTime = 0;

      list.addEventListener('mousedown', (e) => {
        if (window.innerWidth >= 750) return;
        if (typeof gsap !== 'undefined') {
          gsap.killTweensOf(list);
        }
        isMouseDown = true;
        hasDragged = false;
        startMouseX = e.pageX - list.offsetLeft;
        startScrollLeft = list.scrollLeft;
        lastDragX = e.pageX;
        lastDragTime = Date.now();
        dragVelocity = 0;
        list.style.cursor = 'grabbing';
      });

      window.addEventListener('mouseup', () => {
        if (!isMouseDown) return;
        isMouseDown = false;
        list.style.cursor = '';

        if (hasDragged && window.innerWidth < 750) {
          this.snapMobileCarousel(dragVelocity);
        }
      });

      list.addEventListener('mousemove', (e) => {
        if (!isMouseDown || window.innerWidth >= 750) return;
        e.preventDefault();
        const currentX = e.pageX - list.offsetLeft;
        const walk = (currentX - startMouseX) * 1.35;
        list.scrollLeft = startScrollLeft - walk;

        const now = Date.now();
        const dt = now - lastDragTime;
        if (dt > 10) {
          dragVelocity = (e.pageX - lastDragX) / dt;
          lastDragX = e.pageX;
          lastDragTime = now;
        }

        if (Math.abs(walk) > 6) hasDragged = true;
      });

      list.addEventListener('click', (e) => {
        if (hasDragged) {
          e.preventDefault();
          e.stopPropagation();
          hasDragged = false;
        }
      }, true);

      // Real-time Mobile Card Focal Depth on Scroll
      let ticking = false;
      list.addEventListener('scroll', () => {
        if (window.innerWidth >= 750) return;
        if (!ticking) {
          window.requestAnimationFrame(() => {
            this.updateMobileCardDepth();
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });

      // Initial setup
      if (window.innerWidth < 750) {
        setTimeout(() => {
          this.updateMobileCardDepth();
          this.animateBotanicalsPopup();
        }, 150);
      }
    }

    // Standard Original Desktop Slider (CSS Transitions)
    stepMediaDesktop(direction) {
      if (!this.elements.viewer) return;
      const list = this.elements.viewer.querySelector('ul.product__media-list');
      const slides = Array.from(this.elements.viewer.querySelectorAll('li.product__media-item[data-media-id]'));
      if (slides.length <= 1) return;

      const currentIndex = slides.findIndex((slide) => slide.classList.contains('is-active'));
      let newIndex = currentIndex !== -1 ? currentIndex + direction : 0;

      if (newIndex >= slides.length) {
        newIndex = 0;
      } else if (newIndex < 0) {
        newIndex = slides.length - 1;
      }

      const currentSlide = slides[currentIndex];
      const targetSlide = slides[newIndex];

      if (currentSlide && targetSlide && currentSlide !== targetSlide) {
        slides.forEach((s) => {
          s.classList.remove('slide-exit-left', 'slide-exit-right', 'slide-enter-left', 'slide-enter-right');
        });

        if (direction > 0) {
          currentSlide.classList.add('slide-exit-left');
          targetSlide.classList.add('slide-enter-right');
        } else {
          currentSlide.classList.add('slide-exit-right');
          targetSlide.classList.add('slide-enter-left');
        }

        void targetSlide.offsetWidth;
        targetSlide.classList.remove('slide-enter-left', 'slide-enter-right');

        if (list && targetSlide.dataset.colorIndex !== undefined) {
          list.setAttribute('data-active-color', targetSlide.dataset.colorIndex);
        }

        this.setActiveMedia(targetSlide.dataset.mediaId, false);
        this.animateBotanicalsPopup();

        setTimeout(() => {
          if (currentSlide) currentSlide.classList.remove('slide-exit-left', 'slide-exit-right');
        }, 600);
      }
    }

    // GSAP-Powered Smooth Mobile Carousel
    scrollToMobileSlide(targetIdx) {
      const list = this.elements.viewer ? this.elements.viewer.querySelector('ul.product__media-list') : null;
      if (!list) return;
      const slides = Array.from(list.querySelectorAll('li.product__media-item'));
      if (targetIdx < 0 || targetIdx >= slides.length) return;

      const targetSlide = slides[targetIdx];
      const targetScroll = targetSlide.offsetLeft - (list.clientWidth - targetSlide.offsetWidth) / 2;

      if (typeof gsap !== 'undefined') {
        gsap.to(list, {
          scrollLeft: Math.max(0, targetScroll),
          duration: 0.58,
          ease: 'power3.out',
          overwrite: 'auto',
          onUpdate: () => this.updateMobileCardDepth()
        });
      } else {
        list.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    }

    snapMobileCarousel(velocity = 0) {
      const list = this.elements.viewer ? this.elements.viewer.querySelector('ul.product__media-list') : null;
      if (!list) return;
      const slides = Array.from(list.querySelectorAll('li.product__media-item'));
      if (slides.length <= 1) return;

      const listCenter = list.scrollLeft + list.clientWidth / 2 - velocity * 130;
      let closestIdx = 0;
      let minDiff = Infinity;

      slides.forEach((slide, idx) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const diff = Math.abs(slideCenter - listCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      this.scrollToMobileSlide(closestIdx);
    }

    updateMobileCardDepth() {
      const list = this.elements.viewer ? this.elements.viewer.querySelector('ul.product__media-list') : null;
      if (!list) return;
      const slides = Array.from(list.querySelectorAll('li.product__media-item'));
      const listCenter = list.scrollLeft + list.clientWidth / 2;
      let closestSlide = null;
      let minDiff = Infinity;

      slides.forEach((slide) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const diff = Math.abs(slideCenter - listCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closestSlide = slide;
        }
      });

      if (closestSlide) {
        const isNewSlide = (this.lastActiveSlide !== closestSlide);
        this.lastActiveSlide = closestSlide;

        slides.forEach(s => {
          if (s === closestSlide) {
            s.classList.add('is-active');
          } else {
            s.classList.remove('is-active');
          }
        });
        if (closestSlide.dataset.colorIndex !== undefined) {
          list.setAttribute('data-active-color', closestSlide.dataset.colorIndex);
        }

        if (isNewSlide) {
          this.animateBotanicalsPopup();
        }
      }
    }

    stepMediaMobile(direction) {
      const list = this.elements.viewer ? this.elements.viewer.querySelector('ul.product__media-list') : null;
      if (!list) return;
      const slides = Array.from(list.querySelectorAll('li.product__media-item'));
      if (slides.length <= 1) return;

      const listCenter = list.scrollLeft + list.clientWidth / 2;
      let closestIdx = 0;
      let minDiff = Infinity;

      slides.forEach((slide, idx) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const diff = Math.abs(slideCenter - listCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      let targetIdx = closestIdx + direction;
      if (targetIdx < 0) targetIdx = 0;
      if (targetIdx >= slides.length) targetIdx = slides.length - 1;

      this.scrollToMobileSlide(targetIdx);
    }
  });
}
