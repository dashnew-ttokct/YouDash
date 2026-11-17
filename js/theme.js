/* ============================================
   YouDash — менеджер тем
   Переключение: dark → light → amoled → dark
   Иконка всегда луна, цвет берётся из CSS.
   ============================================ */

const Theme = {

  ORDER: ['dark', 'light', 'amoled'],

  LABELS: {
    dark: 'Тёмная',
    light: 'Светлая',
    amoled: 'AMOLED'
  },

  current: 'dark',

  init() {
    this.current = Storage.getTheme() || 'dark';
    if (!this.ORDER.includes(this.current)) this.current = 'dark';
    this.apply(this.current);
    this.updateButtonTitle();
  },

  next() {
    const idx = this.ORDER.indexOf(this.current);
    const nextIdx = (idx + 1) % this.ORDER.length;
    this.set(this.ORDER[nextIdx]);
  },

  set(theme) {
    if (!this.ORDER.includes(theme)) theme = 'dark';
    this.current = theme;
    this.apply(theme);
    this.updateButtonTitle();
    Storage.setTheme(theme);
  },

  apply(theme) {
    document.body.classList.remove('light', 'amoled');
    if (theme === 'light') document.body.classList.add('light');
    if (theme === 'amoled') document.body.classList.add('amoled');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const colors = {
        dark: '#131318',
        light: '#fef7ff',
        amoled: '#000000'
      };
      meta.setAttribute('content', colors[theme] || '#131318');
    }
  },

  updateButtonTitle() {
    const btn = document.getElementById('themeBtn');
    if (!btn) return;
    btn.title = 'Тема: ' + this.LABELS[this.current];
    btn.setAttribute('aria-label', 'Тема: ' + this.LABELS[this.current]);
  }
};