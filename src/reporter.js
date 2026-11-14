'use strict';
/**
 * Reports playback to Jellyfin: /Sessions/Playing, /Sessions/Playing/Progress and /Sessions/Playing/Stopped.
 *
 * Runs in the main process so it is never throttled with the window. It never gives up:
 * - a failed Playing is sent again on the next tick
 * - Stopped messages that fail are queued and delivered, in order, before anything else
 * - when nothing got through for longer than Jellyfin keeps an idle session (sleep, network down),
 *   playback is announced again with Playing instead of Progress
 */

const STALE_AFTER_MS = 4 * 60 * 1000; // Jellyfin stops sessions that have not checked in for ~5 minutes
const MAX_PENDING_STOPS = 50;

class Reporter {
  /**
   * @param {object} opts
   * @param {(path: string, body: object) => Promise<void>} opts.send POSTs to Jellyfin, throws on failure
   * @param {() => number} [opts.now]
   * @param {(msg: string) => void} [opts.log]
   * @param {(status: object) => void} [opts.onStatus]
   */
  constructor({ send, now = Date.now, log = () => {}, onStatus = () => {}, staleAfterMs = STALE_AFTER_MS }) {
    this.send = send;
    this.now = now;
    this.log = log;
    this.onStatus = onStatus;
    this.staleAfterMs = staleAfterMs;
    this.current = null; // what is playing now, or null
    this.pendingStops = []; // Stopped bodies not yet delivered
    this.status = { ok: true, lastOk: 0, lastError: null };
    this._running = null;
    this._again = null;
  }

  /** Latest player state. A new playSessionId means a new track. `event` sends a Progress right away. */
  update(state) {
    if (!state || !state.itemId || !state.playSessionId) return Promise.resolve();
    const cur = this.current;
    if (!cur || cur.playSessionId !== state.playSessionId) {
      if (cur) this._queueStop(cur, cur.positionTicks);
      this.current = { ...state, started: false, lastOk: 0 };
      delete this.current.event;
      return this.flush();
    }
    const { event, ...rest } = state;
    Object.assign(cur, rest);
    return event ? this.flush(event) : Promise.resolve();
  }

  /** Playback of the current track ended (finished, skipped away from, queue cleared or app closing). */
  stop(positionTicks) {
    const cur = this.current;
    if (!cur) return this.flush();
    this.current = null;
    this._queueStop(cur, positionTicks ?? cur.positionTicks);
    return this.flush();
  }

  /** Called on the regular interval (~10 s). */
  tick() {
    return this.flush('TimeUpdate');
  }

  /** Something suggests the connection is back (resume from sleep, network online): report now. */
  kick(reason) {
    if (reason) this.log(`report now: ${reason}`);
    return this.flush('TimeUpdate');
  }

  /** Delivers queued Stopped messages, then Playing or Progress for the current track. Calls are serialised. */
  flush(eventName = 'TimeUpdate') {
    if (this._running) {
      // Run once more after the current pass, keeping the most specific event.
      if (!this._again || eventName !== 'TimeUpdate') this._again = eventName;
      return this._running;
    }
    this._running = (async () => {
      try {
        let ev = eventName;
        for (;;) {
          await this._pass(ev);
          if (!this._again) break;
          ev = this._again;
          this._again = null;
        }
      } finally {
        this._running = null;
      }
    })();
    return this._running;
  }

  async _pass(eventName) {
    while (this.pendingStops.length) {
      const body = this.pendingStops[0];
      if (!(await this._try('/Sessions/Playing/Stopped', body))) return;
      this.pendingStops.shift();
    }
    const cur = this.current;
    if (!cur) return;
    const stale = cur.lastOk && this.now() - cur.lastOk > this.staleAfterMs;
    if (!cur.started || stale) {
      if (stale) this.log('no report got through for a while, announcing playback again');
      if (await this._try('/Sessions/Playing', this._body(cur))) {
        cur.started = true;
        cur.lastOk = this.now();
      }
    } else if (await this._try('/Sessions/Playing/Progress', { ...this._body(cur), EventName: eventName })) {
      cur.lastOk = this.now();
    }
  }

  async _try(path, body) {
    try {
      await this.send(path, body);
      const wasDown = !this.status.ok;
      this.status = { ok: true, lastOk: this.now(), lastError: null };
      if (wasDown) this.log('reporting works again');
      this.onStatus(this.status);
      return true;
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (this.status.ok || this.status.lastError !== msg) this.log(`report to ${path} failed: ${msg}`);
      this.status = { ok: false, lastOk: this.status.lastOk, lastError: msg };
      this.onStatus(this.status);
      return false;
    }
  }

  _queueStop(cur, positionTicks) {
    if (!cur.started) {
      // Never got a Playing through. Only report the stop if we have nothing else to say about it.
      return;
    }
    this.pendingStops.push({
      ItemId: cur.itemId,
      MediaSourceId: cur.itemId,
      PlaySessionId: cur.playSessionId,
      PositionTicks: Math.round(positionTicks || 0),
      Failed: false,
    });
    if (this.pendingStops.length > MAX_PENDING_STOPS) this.pendingStops.shift();
  }

  _body(cur) {
    return {
      ItemId: cur.itemId,
      MediaSourceId: cur.itemId,
      PlaySessionId: cur.playSessionId,
      PlayMethod: cur.playMethod || 'DirectPlay',
      PositionTicks: Math.round(cur.positionTicks || 0),
      IsPaused: !!cur.isPaused,
      IsMuted: !!cur.isMuted,
      VolumeLevel: Math.round(cur.volume ?? 100),
      CanSeek: true,
      RepeatMode: cur.repeatMode || 'RepeatNone',
      PlaybackOrder: cur.shuffled ? 'Shuffle' : 'Default',
    };
  }
}

module.exports = { Reporter, STALE_AFTER_MS };
