/* ============================================
   YouDash — UI
   Весь рендер интерфейса: результаты, статусы,
   контролы. Не трогает логику плеера.
   ============================================ */

const UI = {

  el: {},

  /* ---------- Инициализация ---------- */

  init() {
    this.el = {
      appbar: document.querySelector('.appbar'),
      content: document.getElementById('content'),
      status: document.getElementById('status'),
      results: document.getElementById('results'),
      emptyHint: document.getElementById('emptyHint'),
      searchInput: document.getElementById('searchInput'),
      searchBtn: document.getElementById('searchBtn'),
      presets: document.getElementById('presets'),
      historyBlock: document.getElementById('historyBlock'),
      videoSection: document.getElementById('videoSection'),
      playerControls: document.getElementById('playerControls'),
      nowPlaying: document.getElementById('nowPlaying'),
      currentTime: document.getElementById('current'),
      durationTime: document.getElementById('duration'),
      progressBar: document.getElementById('progress'),
      playIcon: document.getElementById('playIcon')
    };
  },

  /* ---------- Утилиты ---------- */

  formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  },

  setStatus(text, type) {
    if (!this.el.status) return;
    this.el.status.textContent = text || '';
    this.el.status.classList.remove('error', 'success');
    if (type === 'error') this.el.status.classList.add('error');
    if (type === 'success') this.el.status.classList.add('success');
  },

  setLoading(loading) {
    if (this.el.searchBtn) {
      this.el.searchBtn.disabled = !!loading;
    }
  },

  /* ---------- Пресеты ---------- */

  renderPresets() {
    if (!this.el.presets) return;
    this.el.presets.innerHTML = '';
    for (const preset of SEARCH_PRESETS) {
      const chip = document.createElement('button');
      chip.className = 'preset-chip';
      chip.textContent = preset.label;
      chip.addEventListener('click', () => {
        this.el.searchInput.value = preset.query;
        document.dispatchEvent(new CustomEvent('youdash:search', {
          detail: { query: preset.query }
        }));
      });
      this.el.presets.appendChild(chip);
    }
  },

  /* ---------- История поиска ---------- */

  renderSearchHistory() {
    if (!this.el.historyBlock) return;
    const history = Storage.getSearchHistory();

    if (history.length === 0) {
      this.el.historyBlock.innerHTML = '';
      this.el.historyBlock.classList.add('hidden');
      return;
    }

    this.el.historyBlock.classList.remove('hidden');
    this.el.historyBlock.innerHTML = '<div class="history-title">Недавние запросы</div>';

    const list = document.createElement('div');
    list.className = 'history-list';

    for (const q of history) {
      const chip = document.createElement('div');
      chip.className = 'history-chip';

      const label = document.createElement('span');
      label.textContent = q;
      label.style.cursor = 'pointer';
      label.addEventListener('click', () => {
        this.el.searchInput.value = q;
        document.dispatchEvent(new CustomEvent('youdash:search', {
          detail: { query: q }
        }));
      });

      const remove = document.createElement('span');
      remove.className = 'chip-remove';
      remove.textContent = '×';
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        Storage.removeFromSearchHistory(q);
        this.renderSearchHistory();
      });

      chip.appendChild(label);
      chip.appendChild(remove);
      list.appendChild(chip);
    }

    this.el.historyBlock.appendChild(list);
  },

  hideSearchHistory() {
    if (this.el.historyBlock) {
      this.el.historyBlock.classList.add('hidden');
    }
  },

  /* ---------- Результаты поиска ---------- */

  renderResults(items, onItemClick) {
    if (!this.el.results) return;
    this.el.results.innerHTML = '';

    if (!items || items.length === 0) {
      this.el.results.classList.add('hidden');
      return;
    }

    this.el.results.classList.remove('hidden');
    if (this.el.emptyHint) this.el.emptyHint.style.display = 'none';

    items.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'result-item';

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'thumb-wrap';

      const img = document.createElement('img');
      img.src = item.thumbnail || '';
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = function() { this.style.opacity = '0'; };
      thumbWrap.appendChild(img);

      if (item.duration) {
        const badge = document.createElement('div');
        badge.className = 'dur-badge';
        badge.textContent = this.formatTime(item.duration);
        thumbWrap.appendChild(badge);
      }

      const meta = document.createElement('div');
      meta.className = 'meta';

      // Заголовок: приоритет — перевод
      const title = document.createElement('div');
      title.className = 'r-title';
      title.textContent = item.titleRu || item.title || 'Без названия';
      meta.appendChild(title);

      if (item.author) {
        const channel = document.createElement('div');
        channel.className = 'r-channel';
        channel.textContent = item.author;
        meta.appendChild(channel);
      }

      el.appendChild(thumbWrap);
      el.appendChild(meta);

      el.addEventListener('click', () => {
        if (typeof onItemClick === 'function') onItemClick(item, index);
      });

      this.el.results.appendChild(el);
    });
  },

  clearResults() {
    if (this.el.results) {
      this.el.results.innerHTML = '';
      this.el.results.classList.add('hidden');
    }
    if (this.el.emptyHint) this.el.emptyHint.style.display = '';
  },

  /* ---------- Плеер ---------- */

  showPlayer() {
    if (this.el.videoSection) this.el.videoSection.classList.add('active');
    if (this.el.playerControls) this.el.playerControls.classList.add('active');
    if (this.el.emptyHint) this.el.emptyHint.style.display = 'none';

    setTimeout(() => {
      if (this.el.content) {
        this.el.content.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
  },

  hidePlayer() {
    if (this.el.videoSection) this.el.videoSection.classList.remove('active');
    if (this.el.playerControls) this.el.playerControls.classList.remove('active');
  },

  setNowPlaying(title) {
    if (this.el.nowPlaying) {
      this.el.nowPlaying.textContent = title || '';
    }
  },

  setPlayIcon(playing) {
    if (!this.el.playIcon) return;
    const path = playing ? ICON_PAUSE : ICON_PLAY;
    this.el.playIcon.innerHTML = '<path d="' + path + '"/>';
  },

  /* ---------- Прогресс ---------- */

  updateProgress(current, duration) {
    if (!this.el.progressBar) return;

    const percent = duration > 0 ? (current / duration) * 100 : 0;
    this.el.progressBar.value = percent;
    this.el.progressBar.style.setProperty('--p', percent + '%');

    if (this.el.currentTime) {
      this.el.currentTime.textContent = this.formatTime(current);
    }
    if (this.el.durationTime && duration > 0) {
      this.el.durationTime.textContent = this.formatTime(duration);
    }
  },

  updateProgressFromDrag(percent, duration) {
    if (this.el.currentTime) {
      this.el.currentTime.textContent = this.formatTime((percent / 100) * duration);
    }
    if (this.el.progressBar) {
      this.el.progressBar.style.setProperty('--p', percent + '%');
    }
  },

  /* ---------- Тема (для совместимости, основное — в theme.js) ---------- */

  applyTheme(theme) {
    Storage.applyTheme(theme);
  }
};