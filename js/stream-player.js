/* ============================================
   YouDash — Stream Player
   Получает прямые потоки через Piped и играет
   их в HTML5 <video> через jmuxer.
   ============================================ */

const StreamPlayer = {

  // Ссылки на DOM
  videoEl: null,
  jmuxer: null,

  // Состояние
  ready: false,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  rate: 1,

  // Текущее видео
  currentVideo: null,

  // Очередь
  queue: [],
  queueIndex: -1,

  // Ссылки на потоки (нужны для остановки загрузки)
  _videoSource: null,
  _audioSource: null,
  _videoReader: null,
  _audioReader: null,
  _abortController: null,

  // Колбэки
  onStateChange: null,
  onProgress: null,
  onEnded: null,
  onError: null,

  // Таймеры
  _progressTimer: null,

  /* ---------- Инициализация ---------- */

  init() {
    this.videoEl = document.getElementById('html5player');
    if (!this.videoEl) {
      console.error('[StreamPlayer] #html5player не найден');
      return;
    }

    // Инициализируем jmuxer
    const self = this;
    this.jmuxer = new JMuxer({
      node: this.videoEl,
      mode: 'both',
      flushingTime: 500,
      clearBuffer: true,
      debug: false,
      onReady: function() {
        console.log('[jmuxer] ready');
      },
      onError: function(err) {
        console.error('[jmuxer] error:', err);
        if (typeof self.onError === 'function') {
          self.onError(err);
        }
      },
      onMissingVideoFrames: function() {
        // Тихо игнорируем, частая проблема с Piped
      },
      onMissingAudioFrames: function() {
        // Тихо игнорируем
      }
    });

    // Обработчики на самом <video>
    this.videoEl.addEventListener('play', function() {
      self.playing = true;
      if (typeof self.onStateChange === 'function') self.onStateChange('playing');
      self._startProgressTracking();
    });

    this.videoEl.addEventListener('pause', function() {
      self.playing = false;
      if (typeof self.onStateChange === 'function') self.onStateChange('paused');
      self._stopProgressTracking();
    });

    this.videoEl.addEventListener('ended', function() {
      self._stopProgressTracking();
      if (typeof self.onEnded === 'function') self.onEnded();
    });

    this.videoEl.addEventListener('timeupdate', function() {
      self.currentTime = self.videoEl.currentTime;
      self.duration = self.videoEl.duration || 0;
    });

    this.videoEl.addEventListener('error', function(e) {
      console.error('[video] error:', e);
      if (typeof self.onError === 'function') self.onError(e);
    });

    this.ready = true;
  },

  /* ---------- Воспроизведение видео ---------- */

  async playVideo(videoId, title) {
    if (!this.ready || !videoId) return false;

    this.currentVideo = {
      videoId: videoId,
      title: title || ''
    };

    // Останавливаем предыдущее
    this.stop();

    try {
      // Запрашиваем потоки через Piped
      const streams = await this._fetchStreams(videoId);

      if (!streams || !streams.video || !streams.audio) {
        throw new Error('Не удалось получить потоки');
      }

      this._videoSource = streams.video;
      this._audioSource = streams.audio;

      // Запускаем загрузку и подачу в jmuxer
      this._startStreaming();

      return true;
    } catch (e) {
      console.error('[StreamPlayer] playVideo error:', e);
      if (typeof this.onError === 'function') {
        this.onError(e.message || 'Ошибка загрузки');
      }
      return false;
    }
  },

  /* ---------- Получение потоков через Piped ---------- */

  async _fetchStreams(videoId) {
    // Пробуем инстансы по очереди
    const instances = [];
    const lastInstance = Storage.getLastInstance();

    if (lastInstance && PIPED_INSTANCES.includes(lastInstance)) {
      instances.push(lastInstance);
    }
    for (const url of PIPED_INSTANCES) {
      if (url !== lastInstance) instances.push(url);
    }

    for (const instance of instances) {
      try {
        const url = instance + '/streams/' + videoId;
        const controller = new AbortController();
        const timer = setTimeout(function() { controller.abort(); }, 8000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) continue;

        const data = await res.json();
        if (!data || !data.videoStreams) continue;

        // Ищем совместимые потоки: H.264 видео + AAC аудио
        const videoStream = this._pickVideoStream(data.videoStreams);
        const audioStream = this._pickAudioStream(data.audioStreams);

        if (videoStream && audioStream) {
          // Запоминаем рабочий инстанс
          Storage.setLastInstance(instance);
          return { video: videoStream, audio: audioStream };
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  },

  _pickVideoStream(streams) {
    if (!Array.isArray(streams)) return null;

    // Приоритет: MP4 (H.264), 720p, без AV1/VP9
    const candidates = streams.filter(function(s) {
      if (!s.url || !s.videoOnly) return false;
      const codec = (s.codec || '').toLowerCase();
      // Только H.264
      return codec.indexOf('avc') !== -1 || codec.indexOf('h264') !== -1;
    });

    if (candidates.length === 0) return null;

    // Сортируем: сначала 720p, потом меньше
    candidates.sort(function(a, b) {
      const aH = parseInt(a.height) || 0;
      const bH = parseInt(b.height) || 0;
      // Предпочитаем 720p и ниже
      const aScore = (aH <= 720 ? 1000 - aH : aH);
      const bScore = (bH <= 720 ? 1000 - bH : bH);
      return aScore - bScore;
    });

    return candidates[0];
  },

  _pickAudioStream(streams) {
    if (!Array.isArray(streams)) return null;

    // Приоритет: AAC (mp4a), стерео, средний битрейт
    const candidates = streams.filter(function(s) {
      if (!s.url) return false;
      const codec = (s.codec || '').toLowerCase();
      // Только AAC
      return codec.indexOf('mp4a') !== -1 || codec.indexOf('aac') !== -1;
    });

    if (candidates.length === 0) return null;

    // Средний битрейт: сортируем и берём в середине
    candidates.sort(function(a, b) {
      return (parseInt(a.bitrate) || 0) - (parseInt(b.bitrate) || 0);
    });

    return candidates[Math.floor(candidates.length / 2)] || candidates[0];
  },

  /* ---------- Загрузка и подача потоков в jmuxer ---------- */

  async _startStreaming() {
    const self = this;
    this._abortController = new AbortController();

    try {
      // Загружаем видео-поток
      const videoRes = await fetch(this._videoSource.url, {
        signal: this._abortController.signal
      });
      if (!videoRes.ok) throw new Error('Video stream HTTP ' + videoRes.status);

      // Загружаем аудио-поток
      const audioRes = await fetch(this._audioSource.url, {
        signal: this._abortController.signal
      });
      if (!audioRes.ok) throw new Error('Audio stream HTTP ' + audioRes.status);

      // Читаем потоки чанками и подаём в jmuxer
      const videoReader = videoRes.body.getReader();
      const audioReader = audioRes.body.getReader();
      this._videoReader = videoReader;
      this._audioReader = audioReader;

      let videoDone = false;
      let audioDone = false;
      let videoQueue = [];
      let audioQueue = [];

      // Читаем видео
      const readVideo = async function() {
        while (!videoDone) {
          try {
            const result = await videoReader.read();
            if (result.done) {
              videoDone = true;
              break;
            }
            videoQueue.push(result.value);
          } catch (e) {
            videoDone = true;
            break;
          }
        }
      };

      // Читаем аудио
      const readAudio = async function() {
        while (!audioDone) {
          try {
            const result = await audioReader.read();
            if (result.done) {
              audioDone = true;
              break;
            }
            audioQueue.push(result.value);
          } catch (e) {
            audioDone = true;
            break;
          }
        }
      };

      // Запускаем чтение
      readVideo();
      readAudio();

      // Подаём чанки в jmuxer
      const feedLoop = setInterval(function() {
        if (videoQueue.length > 0) {
          const chunk = videoQueue.shift();
          try {
            self.jmuxer.feed({ video: new Uint8Array(chunk) });
          } catch (e) {}
        }
        if (audioQueue.length > 0) {
          const chunk = audioQueue.shift();
          try {
            self.jmuxer.feed({ audio: new Uint8Array(chunk) });
          } catch (e) {}
        }

        // Если оба потока закончились и очереди пусты — останавливаем
        if (videoDone && audioDone && videoQueue.length === 0 && audioQueue.length === 0) {
          clearInterval(feedLoop);
        }
      }, 50);

      // Начинаем воспроизведение
      this.videoEl.play().catch(function(e) {
        console.warn('[video] play error:', e);
      });

    } catch (e) {
      console.error('[StreamPlayer] streaming error:', e);
      if (typeof this.onError === 'function') {
        this.onError(e.message || 'Ошибка стриминга');
      }
    }
  },

  /* ---------- Управление ---------- */

  stop() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    if (this.videoEl) {
      try { this.videoEl.pause(); } catch (e) {}
      try { this.videoEl.src = ''; } catch (e) {}
    }
    this._videoSource = null;
    this._audioSource = null;
    this._videoReader = null;
    this._audioReader = null;
    this.playing = false;
  },

  togglePlay() {
    if (!this.videoEl) return;
    if (this.videoEl.paused) {
      this.videoEl.play().catch(function() {});
    } else {
      this.videoEl.pause();
    }
  },

  pause() {
    if (this.videoEl) {
      try { this.videoEl.pause(); } catch (e) {}
    }
  },

  seekTo(seconds) {
    if (this.videoEl) {
      try { this.videoEl.currentTime = seconds; } catch (e) {}
    }
  },

  seekToPercent(percent) {
    if (this.videoEl && this.videoEl.duration) {
      this.videoEl.currentTime = (percent / 100) * this.videoEl.duration;
    }
  },

  setPlaybackRate(rate) {
    if (this.videoEl) {
      try { this.videoEl.playbackRate = rate; } catch (e) {}
    }
  },

  setVolume(vol) {
    if (this.videoEl) {
      try { this.videoEl.volume = vol; } catch (e) {}
    }
  },

  /* ---------- Прогресс ---------- */

  _startProgressTracking() {
    if (this._progressTimer) return;
    const self = this;
    this._progressTimer = setInterval(function() {
      if (!self.videoEl) return;
      self.currentTime = self.videoEl.currentTime || 0;
      self.duration = self.videoEl.duration || 0;
      if (typeof self.onProgress === 'function') {
        self.onProgress(self.currentTime, self.duration);
      }
    }, 250);
  },

  _stopProgressTracking() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  },

  /* ---------- Очередь ---------- */

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
    if (this.queue.length === 0) return;
    const nextIdx = (this.queueIndex + 1) % this.queue.length;
    this.playFromQueue(nextIdx);
  },

  prev() {
    if (this.queue.length === 0) return;
    const prevIdx = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
    this.playFromQueue(prevIdx);
  }
};