/* ============================================
   YouDash — перевод
   Переводит названия видео на русский через
   бесплатный Google Translate API (без ключа).
   ============================================ */

const Translate = {

  targetLang: 'ru',
  cache: {},

  async translateText(text) {
    if (!text) return '';

    if (this.cache[text]) {
      return this.cache[text];
    }

    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
                this.targetLang + '&dt=t&q=' + encodeURIComponent(text);

    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, 4000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const translated = data[0]
        ? data[0].map(function(item) { return item[0] || ''; }).join('')
        : '';

      this.cache[text] = translated;
      return translated;
    } catch (e) {
      clearTimeout(timer);
      return text;
    }
  },

  async translateItems(items) {
    if (!items || items.length === 0) return items;

    const batchSize = 5;
    const result = items.slice();

    for (let i = 0; i < result.length; i += batchSize) {
      const batch = result.slice(i, i + batchSize);
      const promises = batch.map(async function(item) {
        if (item.title) {
          const translated = await Translate.translateText(item.title);
          if (translated !== item.title) {
            item.titleRu = translated;
          }
        }
        return item;
      });
      await Promise.all(promises);
    }

    return result;
  }
};