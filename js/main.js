/* ============================================
   YouDash — main
   ============================================ */

(function() {

  'use strict';

  var controlsTimer = null;
  var controlsVisible = true;

  /* ---------- Управление overlay ---------- */

  function showControls() {
    var overlay = document.getElementById('playerOverlay');
    if (!overlay) return;
    overlay.classList.add('visible');
    controlsVisible = true;
    resetControlsTimer();
  }

  function hideControls() {
    var overlay = document.getElementById('playerOverlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    controlsVisible = false;
  }

  function resetControlsTimer() {
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(function() {
      hideControls();
    }, 3000);
  }

  function toggleControls() {
    if (controlsVisible) hideControls();
    else showControls();
  }

  /* ---------- Иконки play/pause ---------- */

  var ICON_PLAY = 'M8 5v14l11-7z';
  var ICON_PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';

  function setPlayIcons(playing) {
    var centerIcon = document.getElementById('centerIcon');
    var ovPlayIcon = document.getElementById('ovPlayIcon');
    var path = playing ? ICON_PAUSE : ICON_PLAY;
    if (centerIcon) centerIcon.innerHTML = '<path d="' + path + '"/>';
    if (ovPlayIcon) ovPlayIcon.innerHTML = '<path d="' + path + '"/>';
  }

  /* ---------- Инициализация ---------- */

  document.addEventListener('DOMContentLoaded', function() {

    UI.init();

    if (typeof Theme !== 'undefined') {
      Theme.init();
      var themeBtn = document.getElementById('themeBtn');
      if (themeBtn) {
        themeBtn.addEventListener('click', function() {
          Theme.next();
        });
      }
    }

    UI.renderPresets();
    UI.renderSearchHistory();

    if (typeof History !== 'undefined') {
      History.init();
      History.render();
    }

    if (typeof Related !== 'undefined') {
      Related.init();
    }

    if (typeof StreamPlayer !== 'undefined') {
      StreamPlayer.init();

      StreamPlayer.onStateChange = function(state) {
        setPlayIcons(state === 'playing');
        if (state === 'playing') resetControlsTimer();
      };

      StreamPlayer.onProgress = function(current, duration) {
        updateOverlayProgress(current, duration);
      };

      StreamPlayer.onEnded = function() {
        StreamPlayer.next();
      };

      StreamPlayer.onError = function(message) {
        UI.setStatus('Ошибка: ' + message, 'error');
      };
    }

    /* ---------- Overlay: тап по видео ---------- */

    var overlay = document.getElementById('playerOverlay');
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        // Если клик по кнопке — не переключаем overlay
        if (e.target.closest('button') || e.target.closest('input')) return;
        toggleControls();
      });
    }

    /* ---------- Центральная кнопка ---------- */

    var centerBtn = document.getElementById('centerBtn');
    if (centerBtn) {
      centerBtn.addEventListener('click', function() {
        if (typeof StreamPlayer !== 'undefined') StreamPlayer.togglePlay();
        showControls();
      });
    }

    /* ---------- Кнопки overlay ---------- */

    var ovPlayPause = document.getElementById('ovPlayPause');
    if (ovPlayPause) {
      ovPlayPause.addEventListener('click', function() {
        if (typeof StreamPlayer !== 'undefined') StreamPlayer.togglePlay();
        showControls();
      });
    }

    var ovPrev = document.getElementById('ovPrev');
    if (ovPrev) {
      ovPrev.addEventListener('click', function() {
        if (typeof StreamPlayer !== 'undefined') StreamPlayer.prev();
        showControls();
      });
    }

    var ovNext = document.getElementById('ovNext');
    if (ovNext) {
      ovNext.addEventListener('click', function() {
        if (typeof StreamPlayer !== 'undefined') StreamPlayer.next();
        showControls();
      });
    }

    var ovFs = document.getElementById('ovFs');
    if (ovFs) {
      ovFs.addEventListener('click', function() {
        enterFullscreen();
      });
    }

    /* ---------- Кнопка скорости ---------- */

    var ovSpeed = document.getElementById('ovSpeed');
    if (ovSpeed) {
      var speeds = [1, 1.25, 1.5, 2, 0.75, 0.5];
      var speedIdx = 0;

      ovSpeed.addEventListener('click', function() {
        speedIdx = (speedIdx + 1) % speeds.length;
        var rate = speeds[speedIdx];
        ovSpeed.textContent = rate + 'x';
        ovSpeed.classList.toggle('active', rate !== 1);
        if (typeof StreamPlayer !== 'undefined') StreamPlayer.setPlaybackRate(rate);
        showControls();
      });
    }

    /* ---------- Прогресс-бар ---------- */

    var ovProgress = document.getElementById('ovProgress');
    if (ovProgress) {
      var isDragging = false;

      var onStart = function() {
        isDragging = true;
        if (typeof StreamPlayer !== 'undefined') StreamPlayer.setDragging(true);
        showControls();
      };

      var onInput = function() {
        var duration = (typeof StreamPlayer !== 'undefined' && StreamPlayer.duration) ? StreamPlayer.duration : 0;
        var current = (parseFloat(ovProgress.value) / 100) * duration;
        var ovCurrent = document.getElementById('ovCurrent');
        if (ovCurrent) ovCurrent.textContent = formatTime(current);
        ovProgress.style.setProperty('--p', ovProgress.value + '%');
      };

      var onEnd = function() {
        if (!isDragging) return;
        isDragging = false;
        if (typeof StreamPlayer !== 'undefined') {
          StreamPlayer.setDragging(false);
          StreamPlayer.seekToPercent(parseFloat(ovProgress.value));
        }
        resetControlsTimer();
      };

      ovProgress.addEventListener('mousedown', onStart);
      ovProgress.addEventListener('touchstart', onStart, { passive: true });
      ovProgress.addEventListener('input', onInput);
      ovProgress.addEventListener('mouseup', onEnd);
      ovProgress.addEventListener('touchend', onEnd);
    }

    /* ---------- Поиск ---------- */

    var searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function() {
        doSearch(document.getElementById('searchInput').value);
      });
    }

    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doSearch(this.value);
      });
      searchInput.addEventListener('focus', function() {
        if (!this.value.trim()) UI.renderSearchHistory();
      });
      searchInput.addEventListener('input', function() {
        if (!this.value.trim() && typeof History !== 'undefined') History.show();
      });
    }

    document.addEventListener('youdash:search', function(e) {
      if (e.detail && e.detail.query) doSearch(e.detail.query);
    });

    document.addEventListener('youdash:playFromHistory', function(e) {
      if (e.detail && e.detail.item) playItem(e.detail.item, 0, [e.detail.item]);
    });

    document.addEventListener('youdash:playRelated', function(e) {
      if (e.detail && e.detail.item) playItem(e.detail.item, 0, [e.detail.item]);
    });

    document.addEventListener('fullscreenchange', function() {
      var fsMode = document.getElementById('fullscreenMode');
      if (!document.fullscreenElement && fsMode && fsMode.classList.contains('active')) {
        exitFullscreen();
      }
    });

    document.addEventListener('webkitfullscreenchange', function() {
      var fsMode = document.getElementById('fullscreenMode');
      if (!document.webkitFullscreenElement && fsMode && fsMode.classList.contains('active')) {
        exitFullscreen();
      }
    });

    /* ---------- Кнопки fullscreen ---------- */

    var fsBack = document.getElementById('fsBack');
    if (fsBack) fsBack.addEventListener('click', exitFullscreen);

    var fsClose = document.getElementById('fsClose');
    if (fsClose) fsClose.addEventListener('click', exitFullscreen);

    // Автоскрытие контролов в fullscreen
    var fsWrap = document.getElementById('fsPlayerWrap');
    if (fsWrap) {
      fsWrap.addEventListener('click', function() {
        var fsMode = document.getElementById('fullscreenMode');
        if (!fsMode) return;
        fsMode.classList.add('show-controls');
        setTimeout(function() {
          fsMode.classList.remove('show-controls');
        }, 3000);
      });
    }

    UI.setStatus('Готово. Введи запрос или вставь ссылку.', 'success');
  });

  /* ---------- Обновление прогресса ---------- */

  function updateOverlayProgress(current, duration) {
    var ovProgress = document.getElementById('ovProgress');
    var ovCurrent = document.getElementById('ovCurrent');
    var ovDuration = document.getElementById('ovDuration');

    if (duration > 0 && ovProgress) {
      var percent = (current / duration) * 100;
      ovProgress.value = percent;
      ovProgress.style.setProperty('--p', percent + '%');
    }
    if (ovCurrent) ovCurrent.textContent = formatTime(current);
    if (ovDuration && duration > 0) ovDuration.textContent = formatTime(duration);
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------- Fullscreen ---------- */

  function enterFullscreen() {
    var fsMode = document.getElementById('fullscreenMode');
    var fsVideo = document.getElementById('html5playerFull');
    var mainVideo = document.getElementById('html5player');
    var fsTitle = document.getElementById('fsTitle');

    if (!fsMode || !fsVideo || !mainVideo) return;

    if (typeof StreamPlayer !== 'undefined' && StreamPlayer.currentVideo) {
      if (fsTitle) fsTitle.textContent = StreamPlayer.currentVideo.title || '';
    }

    fsMode.classList.add('active');

    if (fsMode.requestFullscreen) {
      fsMode.requestFullscreen().catch(function() {});
    } else if (fsMode.webkitRequestFullscreen) {
      fsMode.webkitRequestFullscreen();
    }

    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function() {});
    }

    var t = mainVideo.currentTime || 0;
    try { mainVideo.pause(); } catch (e) {}

    if (typeof StreamPlayer !== 'undefined' && StreamPlayer.currentVideo) {
      setTimeout(function() {
        StreamPlayer.videoEl = fsVideo;
        StreamPlayer.playVideo(
          StreamPlayer.currentVideo.videoId,
          StreamPlayer.currentVideo.title
        ).then(function() {
          setTimeout(function() {
            if (fsVideo.duration) fsVideo.currentTime = t;
          }, 500);
        });
      }, 100);
    }

    fsMode.classList.add('show-controls');
    setTimeout(function() {
      fsMode.classList.remove('show-controls');
    }, 3000);
  }

  function exitFullscreen() {
    var fsMode = document.getElementById('fullscreenMode');
    var fsVideo = document.getElementById('html5playerFull');
    var mainVideo = document.getElementById('html5player');

    if (fsMode) fsMode.classList.remove('active');

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function() {});
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }

    if (screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch (e) {}
    }

    var t = 0;
    if (fsVideo) {
      t = fsVideo.currentTime || 0;
      try { fsVideo.pause(); } catch (e) {}
    }

    if (typeof StreamPlayer !== 'undefined' && StreamPlayer.currentVideo) {
      StreamPlayer.stop();
      setTimeout(function() {
        StreamPlayer.videoEl = mainVideo;
        StreamPlayer.playVideo(
          StreamPlayer.currentVideo.videoId,
          StreamPlayer.currentVideo.title
        ).then(function() {
          setTimeout(function() {
            if (mainVideo.duration) mainVideo.currentTime = t;
          }, 500);
        });
      }, 100);
    }
  }

  /* ---------- Поиск ---------- */

  async function doSearch(query) {
    if (!query || !query.trim()) return;
    query = query.trim();
    UI.hideSearchHistory();
    if (typeof History !== 'undefined') History.hide();
    UI.setLoading(true);
    UI.setStatus('Поиск...');

    var searchStart = performance.now();
    Storage.addToSearchHistory(query);

    try {
      var result = await API.search(query, function(message) {
        UI.setStatus(message);
      });

      UI.setLoading(false);

      if (!result.items || result.items.length === 0) {
        UI.setStatus('Ничего не найдено.', 'error');
        UI.clearResults();
        if (typeof History !== 'undefined') History.show();
        return;
      }

      if (result.source === 'direct') {
        playItem(result.items[0], 0, result.items);
        return;
      }

      var elapsed = Math.round(performance.now() - searchStart);
      UI.setStatus('Найдено: ' + result.items.length + ' за ' + elapsed + ' мс', 'success');

      UI.renderResults(result.items, function(item, index) {
        playItem(item, index, result.items);
      });

      if (typeof Translate !== 'undefined') {
        Translate.translateItems(result.items).then(function(translatedItems) {
          UI.renderResults(translatedItems, function(item, index) {
            playItem(item, index, translatedItems);
          });
        });
      }
    } catch (e) {
      console.error('Search error:', e);
      UI.setLoading(false);
      UI.setStatus('Ошибка поиска. Проверь VPN.', 'error');
      if (typeof History !== 'undefined') History.show();
    }
  }

  /* ---------- Запуск видео ---------- */

  async function playItem(item, index, allItems) {
    if (typeof StreamPlayer === 'undefined') return;

    StreamPlayer.setQueue(allItems, index);

    UI.showPlayer();
    UI.setNowPlaying(item.titleRu || item.title || '');
    UI.setStatus('Загрузка потока...', 'success');

    var started = await StreamPlayer.playVideo(
      item.videoId,
      item.titleRu || item.title
    );

    if (!started) {
      UI.setStatus('Не удалось загрузить поток. Попробуй другое видео.', 'error');
      return;
    }

    Storage.addToHistory(item);
    Storage.setLastVideo(item);

    if (typeof Related !== 'undefined') {
      Related.load(item.videoId);
    }

    showControls();
  }

  /* ---------- Service Worker ---------- */

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('./sw.js').catch(function(err) {
        console.warn('SW registration failed:', err);
      });
    });
  }

})();