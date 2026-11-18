/* ============================================
   YouDash — Stream Player (лёгкий режим)
   Piped → комбинированный MP4 (360p).
   Работает без VPN, свой интерфейс.
   ============================================ */

const StreamPlayer = {

  videoEl: null,
  ready: false,
  playing: false,
  currentTime: 0,
  duration: 0,

  currentVideo: null,
  queue: [],
  queueIndex: -1,

  onStateChange: null,
  onProgress: null,
  onEnded: null,
  onError: null,

  _progressTimer: null,
  _abortController: null,

  init() {
    this.videoEl = document.getElementById('html5player');
    if (!this.videoEl) return console.error('[StreamPlayer] #html5player не найден');

    const self = this;
    this.videoEl.addEventListener('play', () => {
      self.playing = true;
      self.onStateChange && self.onStateChange('playing');
      self._startProgressTracking();
    });
    this.videoEl.addEventListener('pause', () => {
      self.playing = false;
      self.onStateChange && self.onStateChange('paused');
      self._stopProgressTracking();
    });
    this.videoEl.addEventListener('ended', () => {
      self._stopProgressTracking();
      self.onEnded && self.onEnded();
    });
    this.videoEl.addEventListener('timeupdate', () => {
      self.currentTime = self.videoEl.currentTime;
      self.duration = self.videoEl.duration || 0;
    });
    this.videoEl.addEventListener('error', (e) => {
      console.error('[video error]', this.videoEl.error);
      self.onError && self.onError(e);
    });

    this.ready = true;
  },

  async playVideo(videoId, title) {
    if (!this.ready || !videoId) return false;
    this.currentVideo = { videoId, title: title || '' };
    this.stop();

    try {
      const pipedUrl = await this._fetchPiped(videoId);
      if (!pipedUrl) throw new Error('Piped не отдал поток');

      this.videoEl.src = pipedUrl;
      this.videoEl.load();
      await this.videoEl.play();
      return true;
    } catch (e) {
      console.error('[StreamPlayer] playVideo error:', e);
      this.onError && this.onError(e.message || 'Ошибка загрузки');
      return false;
    }
  },

  async _fetchPiped(videoId) {
    const instances = [];
    const last = Storage.getLastInstance();
    if (last && PIPED_INSTANCES.includes(last)) instances.push(last);
    for (const url of PIPED_INSTANCES) if (url !== last) instances.push(url);

    for (const instance of instances) {
      try {
        const res = await fetch(`${instance}/streams/${videoId}`);
        if (!res.ok) continue;
        const data = await res.json();
        const combined = (data.videoStreams || []).find(s => s.url && s.videoOnly === false);
        if (combined) {
          Storage.setLastInstance(instance);
          return combined.url;
        }
      } catch (e) { continue; }
    }
    return null;
  },

  stop() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    if (this.videoEl) {
      try { this.videoEl.pause(); } catch (e) {}
      try { this.videoEl.removeAttribute('src'); this.videoEl.load(); } catch (e) {}
    }
    this.playing = false;
  },

  togglePlay() {
    if (!this.videoEl) return;
    if (this.videoEl.paused) this.videoEl.play().catch(() => {});
    else this.videoEl.pause();
  },

  seekToPercent(percent) {
    if (this.videoEl && this.videoEl.duration) {
      this.videoEl.currentTime = (percent / 100) * this.videoEl.duration;
    }
  },

  setPlaybackRate(rate) {
    if (this.videoEl) this.videoEl.playbackRate = rate;
  },

  setVolume(vol) {
    if (this.videoEl) this.videoEl.volume = vol;
  },

  _startProgressTracking() {
    if (this._progressTimer) return;
    this._progressTimer = setInterval(() => {
      if (!this.videoEl) return;
      this.currentTime = this.videoEl.currentTime || 0;
      this.duration = this.videoEl.duration || 0;
      this.onProgress && this.onProgress(this.currentTime, this.duration);
    }, 250);
  },

  _stopProgressTracking() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
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

  next() {
    if (!this.queue.length) return;
    this.playFromQueue((this.queueIndex + 1) % this.queue.length);
  },

  prev() {
    if (!this.queue.length) return;
    this.playFromQueue((this.queueIndex - 1 + this.queue.length) % this.queue.length);
  }
};
