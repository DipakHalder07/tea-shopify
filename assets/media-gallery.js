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
      const thumbnail = this.elements.thumbnails.querySelector(`[data-target="${ event.detail.currentElement.dataset.mediaId }"]`);
      this.setActiveThumbnail(thumbnail);
    }

    setActiveMedia(mediaId, prepend) {
      const activeMedia = this.elements.viewer.querySelector(`li.product__media-item[data-media-id="${ mediaId }"]`) || this.elements.viewer.querySelector(`[data-media-id="${ mediaId }"]`);
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
          const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`);
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
      const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`);
      if (activeThumbnail) {
        this.setActiveThumbnail(activeThumbnail);
        if (activeThumbnail.dataset && activeThumbnail.dataset.mediaPosition) {
          this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
        }
      }
      this.animateBotanicalsPopup();
    }

    setActiveThumbnail(thumbnail) {
      if (!this.elements.thumbnails || !thumbnail) return;

      this.elements.thumbnails.querySelectorAll('button').forEach((element) => element.removeAttribute('aria-current'));
      const thumbBtn = thumbnail.querySelector('button');
      if (thumbBtn) thumbBtn.setAttribute('aria-current', true);

      const slider = this.elements.thumbnails.slider || this.elements.thumbnails.querySelector('ul.thumbnail-list');
      if (slider) {
        const offsetLeft = thumbnail.offsetLeft;
        const itemWidth = thumbnail.offsetWidth || thumbnail.clientWidth;
        const scrollLeft = slider.scrollLeft;
        const clientWidth = slider.clientWidth;

        if (offsetLeft < scrollLeft) {
          slider.scrollTo({ left: offsetLeft, behavior: 'smooth' });
        } else if (offsetLeft + itemWidth > scrollLeft + clientWidth) {
          slider.scrollTo({ left: offsetLeft + itemWidth - clientWidth, behavior: 'smooth' });
        }
      }
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
      if (this.closest('quick-add-modal') || this.closest('.quick-add-modal')) return;
      const prevBtn = this.querySelector('[data-pdp-nav="prev"]');
      const nextBtn = this.querySelector('[data-pdp-nav="next"]');
      const list = this.elements.viewer ? this.elements.viewer.querySelector('ul.product__media-list') : null;
      if (!list) return;

      const slides = Array.from(list.querySelectorAll('li.product__media-item'));
      if (!slides.length) return;

      const initialActive = list.querySelector('li.product__media-item.is-active') || slides[0];
      if (initialActive) {
        initialActive.classList.add('is-active');
        this.lastActiveSlide = initialActive;
        if (initialActive.dataset.colorIndex !== undefined) {
          list.setAttribute('data-active-color', initialActive.dataset.colorIndex);
        }
      }

      // Render Pagination Dots
      this.renderMobileDots(slides);

      // Prev & Next Buttons (Desktop & Mobile)
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.stepMedia(-1);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.stepMedia(1);
        });
      }

      // Thumbnail Prev & Next Buttons on Mobile
      const thumbPrev = this.elements.thumbnails ? this.elements.thumbnails.querySelector('.slider-button--prev') : null;
      const thumbNext = this.elements.thumbnails ? this.elements.thumbnails.querySelector('.slider-button--next') : null;

      if (thumbPrev) {
        thumbPrev.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.stepMedia(-1);
        });
      }

      if (thumbNext) {
        thumbNext.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.stepMedia(1);
        });
      }

      // Touch Swipe Gesture for Natural Mobile Interaction
      let touchStartX = 0;
      let touchStartY = 0;
      let isSwiping = false;

      list.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length === 0) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwiping = true;
      }, { passive: true });

      list.addEventListener('touchend', (e) => {
        if (!isSwiping || !e.changedTouches || e.changedTouches.length === 0) return;
        isSwiping = false;
        const diffX = e.changedTouches[0].clientX - touchStartX;
        const diffY = e.changedTouches[0].clientY - touchStartY;
        // Verify genuine horizontal swipe
        if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY) * 1.1) {
          if (diffX < 0) {
            this.stepMedia(1);
          } else {
            this.stepMedia(-1);
          }
        }
      }, { passive: true });

      // Initial botanical popup
      setTimeout(() => {
        this.animateBotanicalsPopup();
      }, 150);
    }

    renderMobileDots(slides) {
      if (!this.elements.viewer || slides.length <= 1) return;
      let dotsWrap = this.querySelector('.pdp-mobile-dots');
      if (dotsWrap) dotsWrap.remove();

      dotsWrap = document.createElement('div');
      dotsWrap.className = 'pdp-mobile-dots';
      dotsWrap.setAttribute('aria-label', 'Product packaging slides');

      slides.forEach((slide, idx) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = `pdp-dot ${slide.classList.contains('is-active') ? 'is-active' : ''}`;
        dot.setAttribute('aria-label', `Go to slide ${idx + 1}`);
        dot.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const curr = slides.findIndex((s) => s.classList.contains('is-active'));
          if (curr !== idx) {
            this.stepMedia(idx > curr ? 1 : -1, idx);
          }
        });
        dotsWrap.appendChild(dot);
      });

      this.elements.viewer.appendChild(dotsWrap);
    }

    updateDots(activeIdx) {
      const dots = this.querySelectorAll('.pdp-mobile-dots .pdp-dot');
      dots.forEach((dot, idx) => {
        if (idx === activeIdx) {
          dot.classList.add('is-active');
        } else {
          dot.classList.remove('is-active');
        }
      });
    }

    // Unified In-Place Slide Navigation for Both Desktop & Mobile
    stepMedia(direction, specificIndex = null) {
      if (!this.elements.viewer) return;
      const list = this.elements.viewer.querySelector('ul.product__media-list');
      const slides = Array.from(this.elements.viewer.querySelectorAll('li.product__media-item[data-media-id]'));
      if (slides.length <= 1) return;

      const currentIndex = slides.findIndex((slide) => slide.classList.contains('is-active'));
      let newIndex;
      if (specificIndex !== null && specificIndex >= 0 && specificIndex < slides.length) {
        newIndex = specificIndex;
      } else {
        newIndex = currentIndex !== -1 ? currentIndex + direction : 0;
        if (newIndex >= slides.length) {
          newIndex = 0;
        } else if (newIndex < 0) {
          newIndex = slides.length - 1;
        }
      }

      const currentSlide = slides[currentIndex];
      const targetSlide = slides[newIndex];

      if (currentSlide && targetSlide && currentSlide !== targetSlide) {
        const isForward = specificIndex !== null ? (newIndex > currentIndex) : (direction > 0);

        slides.forEach((s) => {
          s.classList.remove('slide-exit-left', 'slide-exit-right', 'slide-enter-left', 'slide-enter-right');
        });

        if (isForward) {
          currentSlide.classList.add('slide-exit-left');
          targetSlide.classList.add('slide-enter-right');
        } else {
          currentSlide.classList.add('slide-exit-right');
          targetSlide.classList.add('slide-enter-left');
        }

        void targetSlide.offsetWidth; // Trigger reflow for CSS transitions
        targetSlide.classList.remove('slide-enter-left', 'slide-enter-right');

        if (list && targetSlide.dataset.colorIndex !== undefined) {
          list.setAttribute('data-active-color', targetSlide.dataset.colorIndex);
        }

        this.setActiveMedia(targetSlide.dataset.mediaId, false);
        this.updateDots(newIndex);
        this.animateBotanicalsPopup();

        setTimeout(() => {
          if (currentSlide) currentSlide.classList.remove('slide-exit-left', 'slide-exit-right');
        }, 600);
      }
    }

    stepMediaDesktop(direction) {
      this.stepMedia(direction);
    }

    stepMediaMobile(direction) {
      this.stepMedia(direction);
    }
  });
}
