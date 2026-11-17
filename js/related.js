/* ============================================
   YouDash — похожие видео
   Показывает рекомендации из Piped под плеером.
   ============================================ */

const Related = {

  el: null,
  currentVideoId: null,
  isLoading: false,

  init() {
    this.el = document.getElementById('relatedSection');
    if (!this.el) {
      const content = document.getElementById('content');
      if (!content) return;
      this.el = document.createElement('section');
      this.el.className = 'related-section';
      this.el.id = 'relatedSection';
      content.appendChild(this.el);
    }
  },

  async load(videoId) {
    if (!this.el) return;
    if (!videoId) return;

    // Если уже загружено для этого видео — не трогаем
    if (this.currentVideoId === videoId && this.el.classList.contains('active')) {
      return;
    }

    this.currentVideoId = videoId;
    this.isLoading = true;

    // Скелетон
    this.showSkeleton();

    try {
      const items = await API.getRelated(videoId);

      // Пользователь мог переключить видео
      if (this.currentVideoId !== videoId) return;

      if (!items || items.length === 0) {
        this.hide();
        this.isLoading = false;
        return;
      }

      this.render(items);
      this.isLoading = false;

      // Перевод в фоне
      if (typeof Translate !== 'undefined') {
        Translate.translateItems(items).then(function(translatedItems) {
          if (Related.currentVideoId === videoId) {
            Related.render(translatedItems);
          }
        });
      }
    } catch (e) {
      console.warn('Related load error:', e);
      if (this.currentVideoId === videoId) {
        this.hide();
      }
      this.isLoading = false;
    }
  },

  showSkeleton() {
    if (!this.el) return;
    this.el.classList.add('active');

    let html = '<div class="related-header">' +
      '<div class="title">Похожие</div>' +
      '<div class="loading-text">Загрузка...</div>' +
      '</div>';

    html += '<div class="related-grid">';
    for (let i = 0; i < 4; i++) {
      html += '<div class="related-skeleton"></div>';
    }
    html += '</div>';

    this.el.innerHTML = html;
  },

  render(items) {
    if (!this.el) return;
    if (!items || items.length === 0) {
      this.hide();
      return;
    }

    items = items.slice(0, 8);

    let html = '<div class="related-header">' +
      '<div class="title">Похожие</div>' +
      '</div>';

    html += '<div class="related-grid" id="relatedGrid"></div>';
    this.el.innerHTML = html;
    this.el.classList.add('active');

    const grid = this.el.querySelector('#relatedGrid');

    items.forEach(function(item) {
      const card = document.createElement('div');
      card.className = 'related-card';

      const thumb = document.createElement('div');
      thumb.className = 'thumb';

      const img = document.createElement('img');
      img.src = item.thumbnail || '';
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = function() { this.style.opacity = '0'; };
      thumb.appendChild(img);

      if (item.duration) {
        const badge = document.createElement('div');
        badge.className = 'dur-badge';
        badge.textContent = UI.formatTime(item.duration);
        thumb.appendChild(badge);
      }

      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = item.titleRu || item.title || 'Без названия';

      card.appendChild(thumb);
      card.appendChild(title);

      if (item.author) {
        const channel = document.createElement('div');
        channel.className = 'card-channel';
        channel.textContent = item.author;
        card.appendChild(channel);
      }

      card.addEventListener('click', function() {
        document.dispatchEvent(new CustomEvent('youdash:playRelated', {
          detail: { item: item }
        }));
      });

      grid.appendChild(card);
    });
  },

  hide() {
    if (this.el) {
      this.el.classList.remove('active');
      this.el.innerHTML = '';
    }
    this.currentVideoId = null;
  },

  show() {
    if (this.el && this.currentVideoId) {
      this.el.classList.add('active');
    }
  }
};