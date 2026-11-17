/* ============================================
   YouDash — хранилище
   Обёртка над localStorage. Всё сохраняется
   только в телефоне пользователя, без сервера.
   ============================================ */

const Storage = {

  /* ---------- Внутренние помощники ---------- */

  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Storage read error:', key, e);
      return fallback;
    }
  },

  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Storage write error:', key, e);
      return false;
    }
  },

  _remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage remove error:', key, e);
    }
  },

  /* ---------- История просмотров ---------- */

  getHistory() {
    return this._get(STORAGE_KEYS.HISTORY, []);
  },

  addToHistory(video) {
    // video = { videoId, title, author, thumbnail, duration }
    if (!video || !video.videoId) return;

    let history = this.getHistory();
    // Убираем дубликат, если уже смотрел
    history = history.filter(v => v.videoId !== video.videoId);
    // Добавляем свежее в начало
    history.unshift({
      videoId: video.videoId,
      title: video.title || '',
      author: video.author || '',
      thumbnail: video.thumbnail || '',
      duration: video.duration || 0,
      watchedAt: Date.now()
    });
    // Обрезаем до лимита
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    this._set(STORAGE_KEYS.HISTORY, history);
  },

  removeFromHistory(videoId) {
    let history = this.getHistory();
    history = history.filter(v => v.videoId !== videoId);
    this._set(STORAGE_KEYS.HISTORY, history);
  },

  clearHistory() {
    this._remove(STORAGE_KEYS.HISTORY);
  },

  /* ---------- История поиска ---------- */

  getSearchHistory() {
    return this._get(STORAGE_KEYS.SEARCH_HISTORY, []);
  },

  addToSearchHistory(query) {
    if (!query) return;
    query = query.trim();
    if (!query) return;

    let list = this.getSearchHistory();
    // Дубликаты убираем — свежий запрос в начало
    list = list.filter(q => q !== query);
    list.unshift(query);
    if (list.length > MAX_SEARCH_HISTORY) {
      list = list.slice(0, MAX_SEARCH_HISTORY);
    }
    this._set(STORAGE_KEYS.SEARCH_HISTORY, list);
  },

  removeFromSearchHistory(query) {
    let list = this.getSearchHistory();
    list = list.filter(q => q !== query);
    this._set(STORAGE_KEYS.SEARCH_HISTORY, list);
  },

  clearSearchHistory() {
    this._remove(STORAGE_KEYS.SEARCH_HISTORY);
  },

  /* ---------- Закладки ---------- */

  getBookmarks() {
    return this._get(STORAGE_KEYS.BOOKMARKS, []);
  },

  isBookmarked(videoId) {
    return this.getBookmarks().some(b => b.videoId === videoId);
  },

  toggleBookmark(video) {
    if (!video || !video.videoId) return false;
    let bookmarks = this.getBookmarks();
    const exists = bookmarks.some(b => b.videoId === video.videoId);

    if (exists) {
      bookmarks = bookmarks.filter(b => b.videoId !== video.videoId);
      this._set(STORAGE_KEYS.BOOKMARKS, bookmarks);
      return false;
    } else {
      bookmarks.unshift({
        videoId: video.videoId,
        title: video.title || '',
        author: video.author || '',
        thumbnail: video.thumbnail || '',
        duration: video.duration || 0,
        addedAt: Date.now()
      });
      if (bookmarks.length > MAX_BOOKMARKS) {
        bookmarks = bookmarks.slice(0, MAX_BOOKMARKS);
      }
      this._set(STORAGE_KEYS.BOOKMARKS, bookmarks);
      return true;
    }
  },

  clearBookmarks() {
    this._remove(STORAGE_KEYS.BOOKMARKS);
  },

  /* ---------- Тема ---------- */

  getTheme() {
    return this._get(STORAGE_KEYS.THEME, 'dark');
  },

  setTheme(theme) {
    // theme: 'dark' | 'light' | 'amoled'
    if (!['dark', 'light', 'amoled'].includes(theme)) theme = 'dark';
    this._set(STORAGE_KEYS.THEME, theme);
  },

  // Применение темы (совместимость с main.js, если он ещё использует)
  // Основная логика теперь в theme.js — Theme.apply()
  applyTheme(theme) {
    document.body.classList.remove('light', 'amoled');
    if (theme === 'light') document.body.classList.add('light');
    if (theme === 'amoled') document.body.classList.add('amoled');
  },

  /* ---------- Последнее видео ---------- */

  getLastVideo() {
    return this._get(STORAGE_KEYS.LAST_VIDEO, null);
  },

  setLastVideo(video) {
    if (!video || !video.videoId) return;
    this._set(STORAGE_KEYS.LAST_VIDEO, {
      videoId: video.videoId,
      title: video.title || '',
      author: video.author || '',
      thumbnail: video.thumbnail || '',
      duration: video.duration || 0,
      position: video.position || 0,
      savedAt: Date.now()
    });
  },

  clearLastVideo() {
    this._remove(STORAGE_KEYS.LAST_VIDEO);
  },

  /* ---------- Последний рабочий инстанс ---------- */

  getLastInstance() {
    return this._get(STORAGE_KEYS.LAST_INSTANCE, null);
  },

  setLastInstance(url) {
    if (!url) return;
    this._set(STORAGE_KEYS.LAST_INSTANCE, url);
  },

  clearLastInstance() {
    this._remove(STORAGE_KEYS.LAST_INSTANCE);
  },

  /* ---------- Общая очистка ---------- */

  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => this._remove(key));
  }
};