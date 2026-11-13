'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Settings in a JSON file. The access token is encrypted with Windows DPAPI (Electron safeStorage) when possible. */
class Store {
  constructor(file, safeStorage) {
    this.file = file;
    this.safe = safeStorage;
    this.data = {};
    try {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      this.data = {};
    }
    if (!this.data.deviceId) {
      this.data.deviceId = crypto.randomUUID().replace(/-/g, '');
      this.save();
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get deviceId() {
    return this.data.deviceId;
  }

  get token() {
    const t = this.data.token;
    if (!t) return null;
    try {
      if (t.enc) return this.safe.decryptString(Buffer.from(t.value, 'base64'));
      return t.value;
    } catch {
      return null;
    }
  }

  set token(value) {
    if (!value) {
      delete this.data.token;
    } else if (this.safe && this.safe.isEncryptionAvailable()) {
      this.data.token = { enc: true, value: this.safe.encryptString(value).toString('base64') };
    } else {
      this.data.token = { enc: false, value };
    }
    this.save();
  }

  get(key) {
    return this.data[key];
  }

  set(values) {
    Object.assign(this.data, values);
    this.save();
  }
}

module.exports = { Store };
