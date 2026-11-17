/* ============================================
   YouDash — плеер на Plyr
   Plyr оборачивает YouTube iframe и рисует
   свои контролы, обрезая кнопки YouTube.
   Плюс фикс referrerpolicy для обхода ошибки 153.
   ============================================ */

const Player = {

  main: null,
  fs: null,

  mainReady: false,
  fsReady: false,

  currentVideo: null,
  queue: [],
  queueIndex: -1,

  onStateChange: null,
  onProgress: null,
  onEnded: null,
  onError: null,

  _pendingVideo: null,
  _progressTimer: null,
  _isDragging: false,
  _iframeFixTimer: null,

  init() {},

  /* ---------- Фикс iframe YouTube ---------- */
  // Plyr создаёт iframe сам, и мы не можем задать referrerpolicy
  // через конструктор. Поэтому находим iframe и дописываем атрибут.
  _fixYouTubeIframe() {
    const iframes = document.querySelectorAll('#plyrVideo iframe, #plyrVideoFull iframe');
    iframes.forEach(function(iframe) {
      try {
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        if (!iframe.getAttribute('allow')) {
          iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
        }
        // Перезагружаем src, чтобы применился referrerpolicy
        // (иначе YouTube уже отдал 153)
        const src = iframe.getAttribute('src');
        if (src && !iframe.dataset.fixed) {
          iframe.dataset.fixed = '1';
          iframe.setAttribute('src', src);
        }
      } catch (e) {
        console.warn('iframe fix error:', e);
      }
    });
  },

  _startIframeFixLoop() {
    const self = this;
    if (this._iframeFixTimer) clearInterval(this._iframeFixTimer);
    // Пытаемся фиксить каждую секунду в течение 10 секунд после старта
    let attempts = 0;
    this._iframeFixTimer = setInterval(function() {
      self._fixYouTubeIframe();
      attempts++;
      if (attempts > 10) {
        clearInterval(self._iframeFixTimer);
        self._iframeFixTimer = null;
      }
    }, 1000);
  },

  /* ---------- Создание основного плеера ---------- */

  createMainPlayer() {
    const container = document.getElementById('plyrContainer');
    if (!container) return;

    const self = this;

    container.innerHTML = '<div id="plyrVideo"></div>';

    this.main = new Plyr('#plyrVideo', {
      controls: [
        'play-large',
        'play',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'settings',
        'fullscreen'
      ],
      settings: ['speed'],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      youtube: {
        noCookie: false,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        modestbranding: 1
      },
      ratio: '16:9',
      fullscreen: { enabled: false, fallback: false, iosNative: false },
      storage: { enabled: false },
      tooltips: { controls: false, seek: true }
    });

    this.main.on('ready', function() {
      self.mainReady = true;
      self._fixYouTubeIframe();
      self._startIframeFixLoop();

      if (self._pendingVideo) {
        const pending = self._pendingVideo;
        self._pendingVideo = null;
        self.playVideo(pending.videoId, pending.title);
      }
    });

    this.main.on('play', function() {
      if (typeof self.onStateChange === 'function') {
        self.onStateChange(1);
      }
      self._startProgressTracking();
      self._fixYouTubeIframe();
    });

    this.main.on('pause', function() {
      if (typeof self.onStateChange === 'function') {
        self.onStateChange(2);
      }
      self._stopProgressTracking();
    });

    this.main.on('ended', function() {
      self._stopProgressTracking();
      if (typeof self.onEnded === 'function') self.onEnded();
    });

    this.main.on('timeupdate', function() {
      if (self._isDragging) return;
      const current = self.main.currentTime || 0;
      const duration = self.main.duration || 0;
      if (typeof self.onProgress === 'function') {
        self.onProgress(current, duration);
      }
    });

    this.main.on('error', function(e) {
      console.error('Plyr error:', e);
      if (typeof self.onError === 'function') self.onError(e);
    });
  },

  /* ---------- Воспроизведение ---------- */

  playVideo(videoId, title) {
    if (!videoId) return false;

    if (!this.main || !this.mainReady) {
      this._pendingVideo = { videoId: videoId, title: title };
      return false;
    }

    this.currentVideo = {
      videoId: videoId,
      title: title || '',
      author: '',
      thumbnail: 'https://i.ytimg.com/vi/' + videoId + '/mqdefault.jpg',
      duration: 0
    };

    this.main.source = {
      type: 'video',
      sources: [{
        src: videoId,
        provider: 'youtube'
      }]
    };

    // После смены источника Plyr пересоздаёт iframe — фиксим его
    const self = this;
    setTimeout(function() { self._fixYouTubeIframe(); }, 500);
    setTimeout(function() { self._fixYouTubeIframe(); }, 1500);

    return true;
  },

  setQueue(items, startIndex) {
    this.queue = items || [];
    this.queueIndex = (typeof startIndex === 'number') ? startIndex : -1;
  },

  playFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return false;
    this.queueIndex = index;
    const item = this.queue[index];
    return this.playVideo(item.videoId, item.title);
  },

  /* ---------- Управление ---------- */

  togglePlay() {
    if (!this.main || !this.mainReady) return;
    if (this.main.playing) {
      this.main.pause();
    } else {
      this.main.play();
    }
  },

  pause() {
    if (this.main && this.mainReady) {
      try { this.main.pause(); } catch (e) {}
    }
  },

  next() {
    if (this.queue.length === 0) return;
    const nextIdx = (this.queueIndex + 1) % this.queue.length;
    this.playFromQueue(nextIdx);
  },

  prev() {
    if (this.queue.length === 0) return;
    const prevIdx = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
    this.playFromQueue(prevIdx);
  },

  seekTo(seconds) {
    if (this.main && this.mainReady) {
      try { this.main.currentTime = seconds; } catch (e) {}
    }
  },

  seekToPercent(percent) {
    if (!this.main || !this.mainReady) return;
    const duration = this.main.duration || 0;
    if (duration > 0) this.seekTo((percent / 100) * duration);
  },

  seekBy(delta) {
    if (!this.main || !this.mainReady) return;
    const current = this.main.currentTime || 0;
    const duration = this.main.duration || 0;
    const target = Math.max(0, Math.min(duration, current + delta));
    this.seekTo(target);
  },

  setPlaybackRate(rate) {
    if (this.main && this.mainReady) {
      try { this.main.speed = rate; } catch (e) {}
    }
  },

  setVolume(vol) {
    if (this.main && this.mainReady) {
      try { this.main.volume = vol; } catch (e) {}
    }
  },

  /* ---------- Состояние ---------- */

  getCurrentTime() {
    if (this.main && this.mainReady) return this.main.currentTime || 0;
    return 0;
  },

  getDuration() {
    if (this.main && this.mainReady) return this.main.duration || 0;
    return 0;
  },

  isPlaying() {
    if (!this.main || !this.mainReady) return false;
    return this.main.playing || false;
  },

  /* ---------- Прогресс ---------- */

  _startProgressTracking() {
    if (this._progressTimer) return;
    const self = this;
    this._progressTimer = setInterval(function() {
      if (self._isDragging) return;
      if (!self.main || !self.mainReady) return;
      const current = self.main.currentTime || 0;
      const duration = self.main.duration || 0;
      if (typeof self.onProgress === 'function') {
        self.onProgress(current, duration);
      }
    }, 250);
  },

  _stopProgressTracking() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  },

  setDragging(value) {
    this._isDragging = !!value;
  },

  /* ---------- Fullscreen ---------- */

  enterFullscreen() {
    if (!this.main || !this.mainReady) return false;

    const fsMode = document.getElementById('fullscreenMode');
    const fsTitle = document.getElementById('fsTitle');
    if (!fsMode) return false;

    fsMode.classList.add('active');
    if (fsTitle) fsTitle.textContent = this.currentVideo ? this.currentVideo.title : '';

    if (fsMode.requestFullscreen) {
      fsMode.requestFullscreen().catch(function() {});
    } else if (fsMode.webkitRequestFullscreen) {
      fsMode.webkitRequestFullscreen();
    }

    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function() {});
    }

    const self = this;
    const fsContainer = document.getElementById('plyrContainerFull');
    if (fsContainer) {
      fsContainer.innerHTML = '<div id="plyrVideoFull"></div>';
      this.fs = new Plyr('#plyrVideoFull', {
        controls: [
          'play-large',
          'play',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume',
          'settings',
          'fullscreen'
        ],
        settings: ['speed'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        youtube: {
          noCookie: false,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          modestbranding: 1
        },
        ratio: '16:9',
        storage: { enabled: false }
      });

      this.fs.on('ready', function() {
        self.fsReady = true;
        self._fixYouTubeIframe();
        if (self.currentVideo) {
          self.fs.source = {
            type: 'video',
            sources: [{ src: self.currentVideo.videoId, provider: 'youtube' }]
          };
          self.fs.play();
          setTimeout(function() { self._fixYouTubeIframe(); }, 500);
          setTimeout(function() { self._fixYouTubeIframe(); }, 1500);
        }
      });
    }

    if (this.main && this.mainReady) {
      try { this.main.pause(); } catch (e) {}
    }

    this.showFsControls();
    return true;
  },

  exitFullscreen() {
    const fsMode = document.getElementById('fullscreenMode');
    if (fsMode) fsMode.classList.remove('active');

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function() {});
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }

    if (screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch (e) {}
    }

    if (this.main && this.mainReady && this.fs && this.fsReady) {
      const t = this.fs.currentTime || 0;
      try {
        this.main.currentTime = t;
        this.main.play();
      } catch (e) {}
    }

    const fsContainer = document.getElementById('plyrContainerFull');
    if (fsContainer) fsContainer.innerHTML = '';
    this.fs = null;
    this.fsReady = false;
  },

  showFsControls() {
    const fsMode = document.getElementById('fullscreenMode');
    if (!fsMode) return;
    fsMode.classList.add('show-controls');
    if (this._fsHideTimer) clearTimeout(this._fsHideTimer);
    const self = this;
    this._fsHideTimer = setTimeout(function() {
      fsMode.classList.remove('show-controls');
    }, 3000);
  }
};