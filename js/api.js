/* ============================================
   YouDash — API
   Поиск через Piped + Invidious.
   Не работает с DOM. Возвращает данные.
   ============================================ */

const API = {

  /* ---------- Утилиты ---------- */

  extractVideoId(input) {
    if (!input) return null;
    input = String(input).trim();
    for (const pattern of YOUTUBE_URL_PATTERNS) {
      const m = input.match(pattern);
      if (m) return m[1];
    }
    return null;
  },

  async fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout || API_TIMEOUT);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  },

  /* ---------- Piped ---------- */

  async searchPiped(instance, query) {
    const url = instance + '/search?q=' + encodeURIComponent(query) + '&filter=videos';
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    if (!data || !Array.isArray(data.items)) return [];

    const result = [];
    for (const v of data.items) {
      if (!v.url || v.url.indexOf('watch?v=') === -1) continue;
      const vid = v.url.split('v=')[1] ? v.url.split('v=')[1].split('&')[0] : '';
      if (!vid) continue;

      result.push({
        videoId: vid,
        title: v.title || '',
        author: v.uploaderName || v.uploader || '',
        duration: v.duration || 0,
        thumbnail: v.thumbnail || ''
      });
      if (result.length >= SEARCH_RESULT_LIMIT) break;
    }
    return result;
  },

  /* ---------- Invidious ---------- */

  async searchInvidious(instance, query) {
    const url = instance + '/api/v1/search?q=' + encodeURIComponent(query) + '&type=video';
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const result = [];
    for (const v of data) {
      if (v.type !== 'video' || !v.videoId) continue;

      result.push({
        videoId: v.videoId,
        title: v.title || '',
        author: v.author || '',
        duration: v.lengthSeconds || 0,
        thumbnail: (v.videoThumbnails && v.videoThumbnails[0]) ? v.videoThumbnails[0].url : ''
      });
      if (result.length >= SEARCH_RESULT_LIMIT) break;
    }
    return result;
  },

  /* ---------- Главный поиск ---------- */

  async search(query, onProgress) {
    if (!query || !query.trim()) return { items: [], source: null };
    query = query.trim();

    const directId = this.extractVideoId(query);
    if (directId) {
      return {
        items: [{
          videoId: directId,
          title: 'Загруженное видео',
          author: '',
          duration: 0,
          thumbnail: 'https://i.ytimg.com/vi/' + directId + '/mqdefault.jpg'
        }],
        source: 'direct'
      };
    }

    const lastInstance = Storage.getLastInstance();
    if (lastInstance && PIPED_INSTANCES.includes(lastInstance)) {
      try {
        if (onProgress) onProgress('Поиск...');
        const items = await this.searchPiped(lastInstance, query);
        if (items.length > 0) {
          return { items, source: lastInstance };
        }
      } catch (e) {
        // Падаем в общий цикл
      }
    }

    const allInstances = [];
    for (const url of PIPED_INSTANCES) {
      if (url === lastInstance) continue;
      allInstances.push({ url, type: 'piped' });
    }
    for (const url of INVIDIOUS_INSTANCES) {
      allInstances.push({ url, type: 'invidious' });
    }

    for (const inst of allInstances) {
      try {
        if (onProgress) {
          const host = inst.url.replace('https://', '').split('/')[0];
          onProgress('Поиск через ' + host + '...');
        }

        const items = inst.type === 'piped'
          ? await this.searchPiped(inst.url, query)
          : await this.searchInvidious(inst.url, query);

        if (items.length > 0) {
          if (inst.type === 'piped') {
            Storage.setLastInstance(inst.url);
          }
          return { items, source: inst.url };
        }
      } catch (e) {
        continue;
      }
    }

    return { items: [], source: null };
  },

  /* ---------- Информация о видео ---------- */

  async getVideoInfo(videoId) {
    // Пробуем сначала последний рабочий инстанс, потом — весь список
    const order = [];
    const lastInstance = Storage.getLastInstance();
    if (lastInstance) order.push(lastInstance);
    for (const url of PIPED_INSTANCES) {
      if (url !== lastInstance) order.push(url);
    }

    for (const instance of order) {
      try {
        const url = instance + '/streams/' + videoId;
        const res = await this.fetchWithTimeout(url, 6000);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.title) {
          // Запоминаем рабочий инстанс
          Storage.setLastInstance(instance);
          return data;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  },

  /* ---------- Похожие видео ---------- */

  async getRelated(videoId) {
    const info = await this.getVideoInfo(videoId);
    if (!info) return [];

    // Piped может вернуть relatedStreams в разных форматах
    const streams = info.relatedStreams || [];
    if (!Array.isArray(streams) || streams.length === 0) return [];

    const result = [];
    for (const v of streams) {
      if (!v.url) continue;
      // url может быть "/watch?v=ID"
      const vid = v.url.split('v=')[1] ? v.url.split('v=')[1].split('&')[0] : '';
      if (!vid) continue;

      result.push({
        videoId: vid,
        title: v.title || '',
        author: v.uploaderName || v.uploader || '',
        duration: v.duration || 0,
        thumbnail: v.thumbnail || ''
      });
      if (result.length >= 12) break;
    }

    return result;
  }
};