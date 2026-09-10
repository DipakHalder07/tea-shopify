if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        liveRegion: this.querySelector('[id^="GalleryStatus"]'),
        viewer: this.querySelector('[id^="GalleryViewer"]'),
        thumbnails: this.querySelector('[id^="GalleryThumbnails"]')
      }
      this.mql = window.matchMedia('(min-width: 750px)');
      this.initDesktopNav();
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
      this.elements.viewer.querySelectorAll('li.product__media-item[data-media-id]').forEach((element) => {
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
      window.setTimeout(() => {
        if (this.elements.thumbnails) {
          activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
        }
        if (!this.elements.thumbnails || this.dataset.desktopLayout === 'stacked') {
          activeMedia.scrollIntoView({behavior: 'smooth'});
        }
      });
      this.playActiveMedia(activeMedia);

      if (!this.elements.thumbnails) return;
      const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`);
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

    initDesktopNav() {
      const prevBtn = this.querySelector('[data-pdp-nav="prev"]');
      const nextBtn = this.querySelector('[data-pdp-nav="next"]');
      const list = this.elements.viewer ? this.elements.viewer.querySelector('ul.product__media-list') : null;
      const initialActive = this.elements.viewer ? this.elements.viewer.querySelector('li.product__media-item.is-active') : null;
      if (list && initialActive && initialActive.dataset.colorIndex !== undefined) {
        list.setAttribute('data-active-color', initialActive.dataset.colorIndex);
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.stepMedia(-1);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.stepMedia(1);
        });
      }
    }

    stepMedia(direction) {
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
          // Next button clicked: current slides left, new enters from right
          currentSlide.classList.add('slide-exit-left');
          targetSlide.classList.add('slide-enter-right');
        } else {
          // Prev button clicked: current slides right, new enters from left
          currentSlide.classList.add('slide-exit-right');
          targetSlide.classList.add('slide-enter-left');
        }

        // Trigger reflow to apply initial position
        void targetSlide.offsetWidth;

        // Remove enter classes so the transition to is-active (0,0,0) runs smoothly
        targetSlide.classList.remove('slide-enter-left', 'slide-enter-right');

        if (list && targetSlide.dataset.colorIndex !== undefined) {
          list.setAttribute('data-active-color', targetSlide.dataset.colorIndex);
        }

        this.setActiveMedia(targetSlide.dataset.mediaId, false);

        setTimeout(() => {
          if (currentSlide) currentSlide.classList.remove('slide-exit-left', 'slide-exit-right');
        }, 600);
      }
    }
  });
}

