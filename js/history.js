/* ============================================
   YouDash — история просмотров (UI)
   Показывает сетку последних видео на главном.
   ============================================ */

const History = {

  el: null,

  init() {
    // Находим или создаём контейнер истории
    this.el = document.getElementById('historySection');
    if (!this.el) {
      // Если нет в HTML — создаём сами
      const content = document.getElementById('content');
      if (!content) return;
      this.el = document.createElement('section');
      this.el.className = 'history-section';
      this.el.id = 'historySection';
      // Вставляем перед пустым экраном
      const emptyHint = document.getElementById('emptyHint');
      if (emptyHint && emptyHint.parentNode === content) {
        content.insertBefore(this.el, emptyHint);
      } else {
        content.insertBefore(this.el, content.firstChild);
      }
    }
  },

  render() {
    if (!this.el) return;

    const history = Storage.getHistory();

    if (!history || history.length === 0) {
      this.el.innerHTML = '';
      this.el.classList.add('hidden');
      return;
    }

    this.el.classList.remove('hidden');

    // Заголовок с кнопкой "Очистить"
    let html = '<div class="history-header">' +
      '<div class="title">Недавние</div>' +
      '<button class="clear-btn" id="clearHistoryBtn">Очистить</button>' +
      '</div>';

    // Сетка карточек
    html += '<div class="history-grid" id="historyGrid"></div>';
    this.el.innerHTML = html;

    const grid = this.el.querySelector('#historyGrid');

    history.forEach(function(item) {
      const card = document.createElement('div');
      card.className = 'history-card';

      const thumb = document.createElement('div');
      thumb.className = 'thumb';

      const img = document.createElement('img');
      img.src = item.thumbnail || '';
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = function() { this.style.opacity = '0'; };
      thumb.appendChild(img);

      // Длительность
      if (item.duration) {
        const badge = document.createElement('div');
        badge.className = 'dur-badge';
        badge.textContent = UI.formatTime(item.duration);
        thumb.appendChild(badge);
      }

      // Кнопка удаления
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '×';
      removeBtn.title = 'Удалить из истории';
      removeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        Storage.removeFromHistory(item.videoId);
        History.render();
      });
      thumb.appendChild(removeBtn);

      // Название и канал
      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = item.title || 'Без названия';

      const channel = document.createElement('div');
      channel.className = 'card-channel';
      channel.textContent = item.author || '';

      card.appendChild(thumb);
      card.appendChild(title);
      if (item.author) card.appendChild(channel);

      // Клик — играем видео
      card.addEventListener('click', function() {
        // Создаём событие поиска по videoId
        document.dispatchEvent(new CustomEvent('youdash:playFromHistory', {
          detail: { item: item }
        }));
      });

      grid.appendChild(card);
    });

    // Обработчик "Очистить"
    const clearBtn = this.el.querySelector('#clearHistoryBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (confirm('Очистить всю историю просмотров?')) {
          Storage.clearHistory();
          History.render();
        }
      });
    }
  },

  hide() {
    if (this.el) this.el.classList.add('hidden');
  },

  show() {
    if (!this.el) return;
    const history = Storage.getHistory();
    if (history.length > 0) {
      this.el.classList.remove('hidden');
    }
  }
};