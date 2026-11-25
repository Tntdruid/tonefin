'use strict';
/* global jf */

/**
 * Looks like an <audio> element to the Player, but plays on a network player (DLNA) through the main process.
 * It polls the renderer every second and turns what it sees into the usual media events
 * (playing, pause, timeupdate, loadedmetadata, seeked, ended, error), so queue handling and
 * reporting to Jellyfin work exactly as when playing on this computer.
 */
class RemoteAudio extends EventTarget {
  constructor(device) {
    super();
    this.isRemote = true;
    this.device = device; // { id, name, sinkTypes }
    this.paused = true;
    this.ended = false;
    this.muted = false;
    this.readyState = 0;
    this.error = null;
    this.preload = 'auto';
    this.playMethod = 'DirectPlay';
    this.duration = NaN;
    this.volumePct = null;
    this._src = null;
    this._pos = 0;
    this._posAt = Date.now();
    this._loadSeq = 0;
    this._metaSent = false;
    this._started = false; // has the renderer reported PLAYING for the current song?
    this._failures = 0;
    this._timer = setInterval(() => this._poll(), 1000);
  }

  get currentTime() {
    const extra = this.paused || !this._started ? 0 : (Date.now() - this._posAt) / 1000;
    const t = this._pos + extra;
    return Number.isFinite(this.duration) ? Math.min(t, this.duration) : t;
  }

  set currentTime(sec) {
    this._setPos(sec);
    jf.dlna.seek(sec).then(() => this._emit('seeked')).catch(() => this._emit('seeked'));
  }

  /** Starts a song on the renderer. media: { itemId, container, title, artist, album, cover, durationSec, playSessionId, transcode, startAt } */
  loadItem(media, autoplay) {
    const seq = ++this._loadSeq;
    this._src = media.itemId;
    this.ended = false;
    this.error = null;
    this._started = false;
    this._metaSent = false;
    this._failures = 0;
    this.readyState = 0;
    this.duration = media.durationSec || NaN;
    this._setPos(0);
    this.paused = !autoplay;
    this._pendingSeek = media.startAt > 1 ? media.startAt : 0;
    jf.dlna
      .load(media)
      .then((res) => {
        if (seq !== this._loadSeq) return null;
        this.playMethod = res && res.direct ? 'DirectPlay' : 'Transcode';
        return autoplay ? jf.dlna.play() : null;
      })
      .catch((e) => seq === this._loadSeq && this._fail(4, e));
  }

  play() {
    if (!this._src) return Promise.resolve();
    this._expect('PLAYING');
    return jf.dlna
      .play()
      .then(() => {
        // Tell the player right away (not on the next poll), so the "Unpause" report isn't late.
        if (this.paused && this._started) {
          this.paused = false;
          this._posAt = Date.now();
          this._emit('playing');
        }
      })
      .catch((e) => this._fail(2, e));
  }

  pause() {
    if (this.paused) return;
    this._setPos(this.currentTime);
    this._expect('PAUSED_PLAYBACK');
    this.paused = true;
    this._emit('pause');
    jf.dlna.pause().catch(() => {});
  }

  setVolumePct(pct) {
    this.volumePct = pct;
    jf.dlna.volume(pct).catch(() => {});
    this._emit('volumechange');
  }

  getAttribute(name) {
    return name === 'src' ? this._src : null;
  }

  removeAttribute(name) {
    if (name !== 'src') return;
    this._src = null;
    this._loadSeq++;
    this.paused = true;
    jf.dlna.stop().catch(() => {});
  }

  load() {}

  /** Stops polling. The song keeps playing on the renderer unless stop is true. */
  dispose(stop = true) {
    clearInterval(this._timer);
    this._loadSeq++;
    if (stop) jf.dlna.stop().catch(() => {});
  }

  // ---- internals ----

  /** After a command, ignore the renderer's state for a moment until it has caught up. */
  _expect(state) {
    this._expected = { state, until: Date.now() + 3000 };
  }

  _setPos(sec) {
    this._pos = Math.max(0, Number(sec) || 0);
    this._posAt = Date.now();
  }

  async _poll() {
    if (!this._src) return;
    const seq = this._loadSeq;
    let s;
    try {
      s = await jf.dlna.status();
      this._failures = 0;
    } catch (e) {
      if (++this._failures === 3) this._fail(2, e);
      return;
    }
    if (seq !== this._loadSeq) return;
    const exp = this._expected;
    if (exp && Date.now() < exp.until && s.state !== exp.state && s.state !== 'STOPPED') return;
    this._expected = null;

    if (s.duration && (!Number.isFinite(this.duration) || Math.abs(s.duration - this.duration) > 1)) this.duration = s.duration;
    // Many renderers reset the position to 0 when they stop, so remember where we were.
    const before = this.currentTime;
    const stopped = s.state === 'STOPPED' || s.state === 'NO_MEDIA_PRESENT';
    if (!stopped && s.position !== null && s.position !== undefined) this._setPos(s.position);

    if (s.state === 'PLAYING') {
      this.readyState = 4;
      if (!this._metaSent) {
        this._metaSent = true;
        this._emit('loadedmetadata');
        if (this._pendingSeek) {
          const at = this._pendingSeek;
          this._pendingSeek = 0;
          this.currentTime = at;
        }
      }
      if (!this._started || this.paused) {
        this._started = true;
        this.paused = false;
        this._emit('playing');
      }
      this._emit('timeupdate');
      return;
    }
    if (s.state === 'PAUSED_PLAYBACK') {
      if (!this.paused) {
        this.paused = true;
        this._emit('pause');
      }
      this._emit('timeupdate');
      return;
    }
    if (stopped && this._started && !this.ended) {
      // The renderer stopped by itself: the end of the song, or someone pressed stop on the device.
      const nearEnd = Number.isFinite(this.duration) && before >= this.duration - 4;
      this.paused = true;
      if (nearEnd) {
        this.ended = true;
        this._setPos(Number.isFinite(this.duration) ? this.duration : this._pos);
        this._emit('pause');
        this._emit('ended');
      } else {
        this._emit('pause');
      }
    }
  }

  _fail(code, e) {
    this.error = { code, message: (e && e.message) || String(e) };
    this._emit('error');
  }

  _emit(type) {
    this.dispatchEvent(new Event(type));
  }
}

window.RemoteAudio = RemoteAudio;
