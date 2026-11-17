/* ============================================
   YouDash — конфигурация
   Все константы проекта в одном месте.
   ============================================ */

const PIPED_INSTANCES = [
  'https://pipedapi.ducks.party',
  'https://api.piped.private.coffee'
];

const INVIDIOUS_INSTANCES = [
  'https://invidious.f5.si'
];

// --- Таймауты ---
const API_TIMEOUT = 6000;         // 6 сек на каждый инстанс
const SEARCH_RESULT_LIMIT = 20;   // максимум результатов поиска

// --- Ключи localStorage ---
const STORAGE_KEYS = {
  HISTORY: 'youdash_history',           // история просмотров
  SEARCH_HISTORY: 'youdash_search',     // история поиска
  BOOKMARKS: 'youdash_bookmarks',       // закладки
  THEME: 'youdash_theme',               // тема: dark / light / amoled
  LAST_VIDEO: 'youdash_last_video',     // последнее видео
  LAST_INSTANCE: 'youdash_instance'     // последний рабочий инстанс
};

// --- Ограничения хранилища ---
const MAX_HISTORY = 30;           // сколько просмотров хранить
const MAX_SEARCH_HISTORY = 10;    // сколько запросов хранить
const MAX_BOOKMARKS = 100;        // сколько закладок хранить

// --- Пресеты поиска (чипы над результатами) ---
const SEARCH_PRESETS = [
  { label: 'Музыка',  query: 'music' },
  { label: 'Игры',    query: 'gameplay' },
  { label: 'Подкасты', query: 'podcast' },
  { label: 'Новости', query: 'news' },
  { label: 'Lofi',    query: 'lofi hip hop' }
];

// --- Скорости воспроизведения ---
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// --- Состояния YouTube-плеера (соответствуют YT.PlayerState) ---
const PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5
};

// --- Регулярки для извлечения videoId из ссылок YouTube ---
const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  /^([a-zA-Z0-9_-]{11})$/
];

// --- Прочее ---
const ICON_PLAY = 'M8 5v14l11-7z';
const ICON_PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';