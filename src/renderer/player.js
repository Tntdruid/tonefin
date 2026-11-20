'use strict';
/* global jf, t */

const TICKS_PER_SECOND = 10000000;

function newId() {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Plays a queue of Jellyfin audio items with an <audio> element and tells the main process
 * (which reports to Jellyfin) what happens.
 */
class Player extends EventTarget {
  constructor() {
    super();
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.session = null;
    this.queue = [];
    this.index = -1;
    this.shuffled = false;
    this.playSessionId = null;
    this.playMethod = 'DirectPlay';
    this.reported = false; // has the main process been told this track is playing?
    this.errors = 0;
    this.lastUpdate = 0;
    this.retryTimer = null;
    this.repeatMode = 'RepeatNone'; // RepeatNone | RepeatAll | RepeatOne (Jellyfin's names)
    this.normalization = 'off'; // off | track | album
    this.gainDb = 0;
    this.volumePct = 80;
    this.albumGain = null; // async (albumId) => dB or null, set by the app
    this._wire();
  }

  get current() {
    return this.queue[this.index] || null;
  }

  setSession(session) {
    this.session = session;
  }

  // ---- queue ----

  /** radio: the queue is an Instant Mix that the app keeps topping up. */
  playList(items, start = 0, { shuffle = false, radio = false } = {}) {
    const list = items.filter((i) => i.Type === 'Audio');
    if (!list.length) return;
    this.radio = !!radio;
    let startItem = items[start] && items[start].Type === 'Audio' ? items[start] : list[0];
    this.queue = list.slice();
    this.shuffled = false;
    if (shuffle) {
      this._shuffle(this.queue);
      this.shuffled = true;
      startItem = this.queue[0];
    }
    this.playIndex(this.queue.indexOf(startItem));
  }

  enqueue(items) {
    const list = items.filter((i) => i.Type === 'Audio');
    this.queue.push(...list);
    this._emit('queue');
    if (this.index < 0) this.playIndex(this.queue.length - list.length);
  }

  playNext(items) {
    const list = items.filter((i) => i.Type === 'Audio');
    if (this.index < 0) return this.enqueue(list);
    this.queue.splice(this.index + 1, 0, ...list);
    this._emit('queue');
  }

  shuffleQueue() {
    if (!this.queue.length) return;
    const cur = this.current;
    const rest = this.queue.filter((_, i) => i !== this.index);
    this._shuffle(rest);
    this.queue = cur ? [cur, ...rest] : rest;
    this.index = cur ? 0 : -1;
    this.shuffled = true;
    this._emit('queue');
  }

  clearQueue() {
    this.radio = false;
    this._leaveTrack();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.queue = [];
    this.index = -1;
    this._emit('track');
    this._emit('queue');
  }

  // ---- transport ----

  playIndex(i, startAt = 0) {
    if (i < 0 || i >= this.queue.length) return;
    this._leaveTrack();
    this.index = i;
    this.playSessionId = newId();
    this.playMethod = 'DirectPlay';
    this._load(startAt);
    this._updateGain();
    this._emit('track');
    this._emit('queue');
  }

  toggle() {
    if (!this.current) return;
    if (this.audio.paused) this.audio.play().catch(() => {});
    else this.audio.pause();
  }

  next() {
    if (this.index + 1 < this.queue.length) this.playIndex(this.index + 1);
    else if (this.repeatMode === 'RepeatAll' && this.queue.length) this.playIndex(0);
  }

  setRepeat(mode) {
    this.repeatMode = ['RepeatAll', 'RepeatOne'].includes(mode) ? mode : 'RepeatNone';
    this._report('RepeatModeChange');
    this._emit('state');
  }

  /** Puts a saved queue back without playing it; playback (and reporting) starts when the user presses play. */
  restore(queue, index, position = 0, { shuffled = false } = {}) {
    const list = (queue || []).filter((i) => i && i.Type === 'Audio');
    if (!list.length || index < 0 || index >= list.length) return;
    this._leaveTrack();
    this.queue = list;
    this.index = index;
    this.shuffled = shuffled;
    this.playSessionId = newId();
    this.playMethod = 'DirectPlay';
    this._load(position, false);
    this._updateGain();
    this._emit('track');
    this._emit('queue');
  }

  prev() {
    if (this.audio.currentTime > 3 || this.index <= 0) this.seek(0);
    else this.playIndex(this.index - 1);
  }

  seek(seconds) {
    if (!this.current || !isFinite(seconds)) return;
    this.audio.currentTime = Math.max(0, seconds);
  }

  /**
   * v is the slider value 0–100. Hearing is logarithmic, so a linear volume makes 20 % sound almost as loud
   * as 100 %. A cubic curve gives about -18 dB at 50 % and -42 dB at 20 %.
   */
  setVolume(v) {
    this.volumePct = Math.min(100, Math.max(0, Number(v) || 0));
    this._applyVolume();
  }

  /** 'off', 'track' or 'album': use Jellyfin's loudness analysis so tracks play equally loud. */
  setNormalization(mode) {
    this.normalization = ['track', 'album'].includes(mode) ? mode : 'off';
    this._updateGain();
  }

  _applyVolume() {
    const base = Math.pow(this.volumePct / 100, 3);
    const gain = this.normalization === 'off' ? 0 : this.gainDb;
    // The <audio> element can only turn down, so a positive gain (a quiet track) is capped at the slider volume.
    this.audio.volume = Math.min(1, base * Math.pow(10, gain / 20));
  }

  async _updateGain() {
    const item = this.current;
    let gain = 0;
    if (item && this.normalization === 'track') gain = item.NormalizationGain ?? 0;
    if (item && this.normalization === 'album') {
      gain = item.NormalizationGain ?? 0;
      if (item.AlbumId && this.albumGain) {
        const albumDb = await this.albumGain(item.AlbumId).catch(() => null);
        if (this.current !== item) return;
        if (typeof albumDb === 'number') gain = albumDb;
      }
    }
    this.gainDb = Number(gain) || 0;
    this._applyVolume();
  }

  get duration() {
    const d = this.audio.duration;
    if (isFinite(d) && d > 0) return d;
    return this.current && this.current.RunTimeTicks ? this.current.RunTimeTicks / TICKS_PER_SECOND : 0;
  }

  /** After sleep or a network change: if the stream died, start it again where it was. */
  recover() {
    if (!this.current) return;
    const a = this.audio;
    if (a.error || (!a.paused && a.readyState < 3)) {
      this._load(a.currentTime || 0, !a.paused || !!a.error);
    }
  }

  // ---- internals ----

  _streamUrl(item) {
    const s = this.session;
    const q = new URLSearchParams({
      ApiKey: s.token,
      DeviceId: s.deviceId,
      PlaySessionId: this.playSessionId,
    });
    if (this.playMethod === 'DirectPlay') {
      q.set('static', 'true');
      q.set('MediaSourceId', item.Id);
      return `${s.server}/Audio/${item.Id}/stream?${q}`;
    }
    q.set('UserId', s.userId);
    q.set('Container', 'mp3');
    q.set('TranscodingContainer', 'mp3');
    q.set('TranscodingProtocol', 'http');
    q.set('AudioCodec', 'mp3');
    q.set('MaxStreamingBitrate', '320000');
    return `${s.server}/Audio/${item.Id}/universal?${q}`;
  }

  _load(startAt = 0, autoplay = true) {
    clearTimeout(this.retryTimer);
    const item = this.current;
    const a = this.audio;
    a.src = this._streamUrl(item);
    if (startAt > 0) {
      const seekOnce = () => {
        a.currentTime = startAt;
        a.removeEventListener('loadedmetadata', seekOnce);
      };
      a.addEventListener('loadedmetadata', seekOnce);
    }
    if (autoplay) a.play().catch(() => {});
  }

  _leaveTrack() {
    clearTimeout(this.retryTimer);
    if (this.reported) jf.playerStop(this._ticks(this.audio.currentTime));
    this.reported = false;
  }

  _ticks(seconds) {
    return Math.round((seconds || 0) * TICKS_PER_SECOND);
  }

  _state(event) {
    const item = this.current;
    return {
      itemId: item.Id,
      playSessionId: this.playSessionId,
      playMethod: this.playMethod,
      runTimeTicks: item.RunTimeTicks || 0,
      positionTicks: this._ticks(this.audio.currentTime),
      isPaused: this.audio.paused,
      isMuted: this.audio.muted,
      volume: Math.round(this.volumePct ?? 100),
      shuffled: this.shuffled,
      repeatMode: this.repeatMode,
      event,
    };
  }

  _report(event) {
    if (!this.current || !this.reported) return;
    this.lastUpdate = Date.now();
    jf.playerUpdate(this._state(event));
  }

  _wire() {
    const a = this.audio;
    a.addEventListener('playing', () => {
      this.errors = 0;
      if (!this.reported) {
        this.reported = true;
        this._report();
      } else {
        this._report('Unpause');
      }
      this._emit('state');
    });
    a.addEventListener('pause', () => {
      if (!a.ended) this._report('Pause');
      this._emit('state');
    });
    a.addEventListener('seeked', () => this._report('TimeUpdate'));
    let volTimer = null;
    a.addEventListener('volumechange', () => {
      clearTimeout(volTimer);
      volTimer = setTimeout(() => this._report('VolumeChange'), 400);
    });
    a.addEventListener('timeupdate', () => {
      if (Date.now() - this.lastUpdate >= 1000) this._report();
      this._emit('time');
    });
    a.addEventListener('ended', () => {
      const item = this.current;
      if (this.reported) {
        const end = item && item.RunTimeTicks ? item.RunTimeTicks : this._ticks(a.duration);
        jf.playerStop(end);
      }
      this.reported = false;
      // Each repeat is a new play session, so Jellyfin (and stats) count it as a new listen.
      if (this.repeatMode === 'RepeatOne') this.playIndex(this.index);
      else if (this.index + 1 < this.queue.length) this.playIndex(this.index + 1);
      else if (this.repeatMode === 'RepeatAll') this.playIndex(0);
      else {
        this._emit('state');
        this._emit('queueend', item);
      }
    });
    a.addEventListener('error', () => {
      const err = a.error;
      if (!err || !this.current || !a.getAttribute('src')) return;
      const pos = a.currentTime || 0;
      const wasPlaying = true;
      if (err.code === MediaError.MEDIA_ERR_NETWORK) {
        // Server or network gone: keep trying the same track from the same spot.
        this._emit('error', t('player.netLost'));
        this.retryTimer = setTimeout(() => this._load(pos, wasPlaying), 5000);
        return;
      }
      if (this.playMethod === 'DirectPlay') {
        // Format the built-in player can't decode: ask Jellyfin to convert it to MP3.
        this.playMethod = 'Transcode';
        this._load(pos, wasPlaying);
        return;
      }
      this.errors += 1;
      this._emit('error', t('player.cantPlay', { name: this.current.Name }));
      if (this.errors < 3) this.retryTimer = setTimeout(() => this.next(), 1500);
    });
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

window.Player = Player;
window.TICKS_PER_SECOND = TICKS_PER_SECOND;
