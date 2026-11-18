/* ============================================
   YouDash — Player (HD-режим, YouTube iframe)
   Plyr оборачивает YouTube iframe.
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

  _fixYouTubeIframe() {
    const iframes = document.querySelectorAll('#plyrContainer iframe, #plyrContainerFull iframe');
    iframes.forEach(function(iframe) {
      try {
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        if (!iframe.getAttribute('allow')) {
          iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
        }
        const src = iframe.getAttribute('src');
        if (src && !iframe.dataset.fixed) {
          iframe.dataset.fixed = '1';
          iframe.setAttribute('src', src);
        }
      } catch (e) { console.warn('iframe fix error:', e); }
    });
  },

  _startIframeFixLoop() {
    const self = this;
    if (this._iframeFixTimer) clearInterval(this._iframeFixTimer);
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

  createMainPlayer() {
    const container = document.getElementById('plyrContainer');
    if (!container) {
      // создаём контейнер внутри iframePlayer
      const wrap = document.getElementById('iframePlayer');
      if (!wrap) return;
      wrap.innerHTML = '<div id="plyrContainer" style="width:100%;height:100%;"></div>';
    }
    const el = document.getElementById('plyrContainer');
    if (!el) return;

    const self = this;
    el.innerHTML = '';

    this.main = new Plyr(el, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'fullscreen'],
      settings: ['speed'],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      youtube: { noCookie: false, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1 },
      ratio: '16:9',
      fullscreen: { enabled: true, fallback: true, iosNative: true },
      storage: { enabled: false },
      tooltips: { controls: false, seek: true }
    });

    this.main.on('ready', function() {
      self.mainReady = true;
      self._fixYouTubeIframe();
      self._startIframeFixLoop();
      if (self._pendingVideo) {
        const p = self._pendingVideo;
        self._pendingVideo = null;
        self.playVideo(p.videoId, p.title);
      }
    });

    this.main.on('play', function() {
      if (typeof self.onStateChange === 'function') self.onStateChange(1);
      self._startProgressTracking();
      self._fixYouTubeIframe();
    });

    this.main.on('pause', function() {
      if (typeof self.onStateChange === 'function') self.onStateChange(2);
      self._stopProgressTracking();
    });

    this.main.on('ended', function() {
      self._stopProgressTracking();
      if (typeof self.onEnded === 'function') self.onEnded();
    });

    this.main.on('timeupdate', function() {
      if (self._isDragging) return;
      if (typeof self.onProgress === 'function') {
        self.onProgress(self.main.currentTime || 0, self.main.duration || 0);
      }
    });

    this.main.on('error', function(e) {
      console.error('Plyr error:', e);
      if (typeof self.onError === 'function') self.onError(e);
    });
  },

  playVideo(videoId, title) {
    if (!videoId) return false;
    if (!this.main || !this.mainReady) {
      this._pendingVideo = { videoId, title };
      return false;
    }

    this.currentVideo = {
      videoId,
      title: title || '',
      thumbnail: 'https://i.ytimg.com/vi/' + videoId + '/mqdefault.jpg',
      duration: 0
    };

    this.main.source = {
      type: 'video',
      sources: [{ src: videoId, provider: 'youtube' }]
    };

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

  togglePlay() {
    if (!this.main || !this.mainReady) return;
    if (this.main.playing) this.main.pause();
    else this.main.play();
  },

  pause() {
    if (this.main && this.mainReady) {
      try { this.main.pause(); } catch (e) {}
    }
  },

  next() {
    if (!this.queue.length) return;
    this.playFromQueue((this.queueIndex + 1) % this.queue.length);
  },

  prev() {
    if (!this.queue.length) return;
    this.playFromQueue((this.queueIndex - 1 + this.queue.length) % this.queue.length);
  },

  seekToPercent(percent) {
    if (!this.main || !this.mainReady) return;
    const duration = this.main.duration || 0;
    if (duration > 0) this.main.currentTime = (percent / 100) * duration;
  },

  setPlaybackRate(rate) {
    if (this.main && this.mainReady) {
      try { this.main.speed = rate; } catch (e) {}
    }
  },

  _startProgressTracking() {
    if (this._progressTimer) return;
    const self = this;
    this._progressTimer = setInterval(function() {
      if (self._isDragging) return;
      if (!self.main || !self.mainReady) return;
      if (typeof self.onProgress === 'function') {
        self.onProgress(self.main.currentTime || 0, self.main.duration || 0);
      }
    }, 250);
  },

  _stopProgressTracking() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  },

  setDragging(value) { this._isDragging = !!value; }
};
