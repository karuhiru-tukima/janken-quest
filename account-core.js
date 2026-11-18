/* Firebase owns credentials. This module stores only allowlisted game data. */
(function (root) {
  'use strict';
  const LIMITS = Object.freeze({
    'jq-progress': 64000, 'jq-cards': 1048576, 'jq-resume': 262144,
    'jq-home-kaede': 32, 'jq-sort': 2048, 'jq-nick': 128,
  });
  const KEYS = Object.keys(LIMITS);
  const allowed = key => typeof key === 'string' && Object.hasOwn(LIMITS, key);
  const identity = user => user && !user.isAnonymous ? user.uid : null;
  function bounded(promise, ms, fallback) {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(fallback), ms);
      Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(fallback); });
    });
  }
  function create(options) {
    const local = options.local, auth = options.auth, database = options.database;
    const notify = options.onChange || (() => {}), mask = options.mask || (() => {});
    let owner = null, user = null, initialized = false, seen = false, generation = 0;
    let timer = 0, writing = null, switching = false, replaced = false, hooks = {}, status = '確認中';
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const keyFor = (key, uid = owner) => uid ? 'jq-user:' + uid + ':' + key : key;
    const memory = new Map();
    const readRaw = key => { if (memory.has(key)) return memory.get(key); try { return local.getItem(key); } catch { return null; } };
    const writeRaw = (key, value) => {
      memory.set(key, value);
      try { value === null ? local.removeItem(key) : local.setItem(key, value); return true; } catch { return false; }
    };
    const dirtyKey = () => 'jq-user:' + owner + ':pending';
    const dirty = new Map();
    const now = options.now || (() => Date.now());
    const idleLimit = 90 * 24 * 60 * 60 * 1000;
    const activityKey = uid => 'jq-auth:' + uid + ':last-active';
    let expiryCheck = false, expiring = false;
    function touch() {
      if (!owner || identity(auth?.currentUser) !== owner) return;
      const last = Number(readRaw(activityKey(owner)));
      if (initialized && last > 0 && now() - last >= idleLimit) {
        if (!expiring) {
          expiring = true; mask(true);
          Promise.resolve(auth.signOut()).catch(() => { expiring = false; mask(false); });
        }
        return;
      }
      if (!last || now() - last >= 60000) writeRaw(activityKey(owner), String(now()));
    }
    function changed(message) { if (message) status = message; notify(); }
    function persistDirty() { if (owner) writeRaw(dirtyKey(), JSON.stringify([...dirty])); }
    function schedule() { clearTimeout(timer); timer = setTimeout(() => { flush(); }, 700); }
    const storage = {
      getItem(key) { if (!allowed(key)) throw new Error('Unsupported game-data key'); return readRaw(keyFor(key)); },
      setItem(key, value) {
        if (!allowed(key)) throw new Error('Unsupported game-data key');
        if (replaced) return;
        value = String(value);
        if (value.length > LIMITS[key]) throw new Error('Game data exceeds the save limit');
        if (readRaw(keyFor(key)) === value) return;
        if (!writeRaw(keyFor(key), value)) changed('この端末に保存できません（一時保存中）');
        if (owner) { dirty.set(key, value); persistDirty(); changed('保存待ち'); schedule(); }
      },
      removeItem(key) {
        if (!allowed(key)) throw new Error('Unsupported game-data key');
        if (replaced) return;
        writeRaw(keyFor(key), null);
        if (owner) { dirty.set(key, null); persistDirty(); schedule(); }
      },
    };
    function profileRef(uid) { return database().ref('jq/users/' + uid); }
    async function hydrate(current, token) {
      const uid = identity(current), pending = new Map();
      if (uid) {
        try {
          const saved = JSON.parse(readRaw('jq-user:' + uid + ':pending') || '[]');
          for (const [key, value] of saved) if (allowed(key) && (value === null || typeof value === 'string' && value.length <= LIMITS[key])) pending.set(key, value);
        } catch {}
        const result = await bounded(profileRef(uid).child('data').once('value').then(snapshot => ({ok: true, data: snapshot.val()})), 2500, {ok: false});
        if (token !== generation) return;
        if (result.ok) {
          for (const key of KEYS) {
            const value = result.data && result.data[key];
            if (!pending.has(key)) writeRaw(keyFor(key, uid), typeof value === 'string' && value.length <= LIMITS[key] ? value : null);
          }
          status = 'アカウントに保存済み';
        } else status = 'この端末に保存中（接続時に再試行）';
      }
      if (token !== generation) return;
      owner = uid; user = uid ? {uid, email: current.email || '', name: current.displayName || ''} : null;
      touch();
      for (const [key, value] of pending) dirty.set(key, value);
      initialized = true;
      if (!uid) status = auth ? 'ゲスト・この端末に保存' : 'ゲスト・ログインに接続できません';
      changed(); resolveReady();
      if (dirty.size) schedule();
    }
    async function saveBeforeChange() {
      if (hooks.save) await hooks.save();
      await bounded(drain(), 1800, null);
      if (hooks.leave) await bounded(hooks.leave(), 1500, null);
    }
    function observe(current) {
      seen = true;
      const uid = identity(current);
      if (!initialized && uid && !expiryCheck) {
        expiryCheck = true;
        const last = Number(readRaw(activityKey(uid)));
        if (last > 0 && now() - last >= idleLimit) {
          // Expire the saved login before reading any of this account's game data.
          Promise.resolve(auth.signOut()).catch(() => observe(null));
          return;
        }
      }
      if (!initialized) {
        const token = ++generation;
        hydrate(current, token).catch(() => {
          if (token !== generation) return;
          owner = identity(current); user = owner ? {uid: owner, email: current.email || '', name: current.displayName || ''} : null;
          initialized = true; changed('この端末に保存中（接続時に再試行）'); resolveReady();
        });
        return;
      }
      if (identity(current) !== owner) {
        mask(true);
        if (switching) return; // Finish registration and its guest transfer before reloading.
        // The page's owner is immutable: late saves can never target the next account.
        Promise.resolve(hooks.save && hooks.save()).catch(() => {}).finally(() => options.reload());
      }
    }
    async function flush() {
      clearTimeout(timer);
      if (!owner || !auth || identity(auth.currentUser) !== owner || !dirty.size) return;
      if (writing) return writing;
      const uid = owner, batch = new Map(dirty), updates = {updatedAt: options.timestamp()};
      for (const [key, value] of batch) updates['data/' + key] = value;
      writing = profileRef(uid).update(updates).then(() => {
        for (const [key, value] of batch) if (dirty.get(key) === value) dirty.delete(key);
        persistDirty(); changed(dirty.size ? '保存待ち' : 'アカウントに保存済み');
      }).catch(() => { changed('この端末に保存中（接続時に再試行）'); }).finally(() => {
        writing = null;
        if (dirty.size && status === '保存待ち') schedule();
      });
      return writing;
    }
    async function drain() {
      for (let count = 0; count < 4; count++) {
        await flush();
        if (!dirty.size || !owner || identity(auth?.currentUser) !== owner || status !== '保存待ち') break;
      }
    }
    async function change(operation) {
      await ready;
      if (!auth) throw Object.assign(new Error('Authentication unavailable'), {code:'auth/unavailable'});
      if (switching) throw Object.assign(new Error('Authentication in progress'), {code:'auth/busy'});
      switching = true; mask(true);
      try {
        await saveBeforeChange();
        // Do not put an email or password into storage, URLs, logs or the game database.
        return await request(operation(auth));
      } finally {
        switching = false;
        const changedOwner = identity(auth.currentUser) !== owner;
        const nextUid = identity(auth.currentUser);
        if (nextUid) writeRaw(activityKey(nextUid), String(now()));
        mask(changedOwner);
        if (changedOwner) options.reload();
      }
    }
    async function request(promise) {
      const result = await bounded(Promise.resolve(promise).then(value => ({value}), error => ({error})), 15000,
        {error: Object.assign(new Error('Authentication timed out'), {code:'auth/network-request-failed'})});
      if (result.error) throw result.error;
      return result.value;
    }
    const api = {
      ready, storage,
      touch,
      guestData() {
        const data = {};
        for (const key of KEYS) {
          const value = readRaw(key);
          if (typeof value === 'string' && value.length <= LIMITS[key]) data[key] = value;
        }
        return data;
      },
      async importGuest() {
        await ready;
        if (!owner || identity(auth?.currentUser) !== owner) throw {code:'auth/account-changed'};
        if (switching) throw {code:'auth/busy'};
        const data = api.guestData();
        if (!Object.keys(data).length) throw {code:'game/no-guest-data'};
        switching = true; mask(true);
        try {
          await saveBeforeChange();
          if (dirty.size) throw {code:'auth/network-request-failed'};
          if (identity(auth.currentUser) !== owner) throw {code:'auth/account-changed'};
          replaced = true; clearTimeout(timer);
          // Replace the entire save together; a missing guest key must not retain account data.
          try { await profileRef(owner).update({data, updatedAt:options.timestamp()}); }
          catch (error) { replaced = false; throw Object.assign(new Error('Import failed'), {code:'game/import-failed'}); }
          for (const key of KEYS) writeRaw(keyFor(key), data[key] ?? null);
          dirty.clear(); persistDirty();
          options.reload();
        } finally { switching = false; if (!replaced) mask(false); }
      },
      get user() { return user && {...user}; },
      get status() { return status; },
      bind(value) { hooks = value; changed(); },
      summary() { return hooks.summary ? hooks.summary() : null; },
      flush: () => bounded(drain(), 2200, null),
      async save() { if (hooks.save) await hooks.save(); await bounded(drain(), 2200, null); },
      signIn(email, password) { return change(a => a.signInWithEmailAndPassword(email, password)); },
      register(email, password) { return change(a => a.createUserWithEmailAndPassword(email, password)); },
      registerWithGuest(email, password) {
        return change(async a => {
          const data = api.guestData();
          const result = await a.createUserWithEmailAndPassword(email, password);
          const uid = identity(result.user);
          if (uid && Object.keys(data).length) {
            // Persist the transfer first so it survives a stalled/offline cloud write.
            for (const key of KEYS) writeRaw(keyFor(key, uid), data[key] ?? null);
            writeRaw('jq-user:' + uid + ':pending', JSON.stringify(Object.entries(data)));
            const saved = await bounded(profileRef(uid).update({data, updatedAt:options.timestamp()}).then(() => true, () => false), 2200, false);
            if (saved) writeRaw('jq-user:' + uid + ':pending', '[]');
          }
          return result;
        });
      },
      signOut() { return change(a => a.signOut()); },
      async resetPassword(email) {
        await ready;
        if (!auth) throw Object.assign(new Error('Authentication unavailable'), {code:'auth/unavailable'});
        try { await request(auth.sendPasswordResetEmail(email)); }
        catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      },
      async onlineUser() {
        await ready;
        if (!auth) throw Object.assign(new Error('Authentication unavailable'), {code:'auth/unavailable'});
        if (identity(auth.currentUser) !== owner) throw Object.assign(new Error('Account changed'), {code:'auth/account-changed'});
        return auth.currentUser || (await auth.signInAnonymously()).user;
      },
      retry() { if (owner) flush(); },
    };
    (async () => {
      if (!auth) { await hydrate(null, ++generation); return; }
      await bounded(auth.setPersistence(options.persistence), 1200, null);
      auth.onAuthStateChanged(observe, () => { if (!initialized) observe(null); });
      setTimeout(() => { if (!seen && !initialized) observe(null); }, 2200);
    })().catch(() => { if (!initialized) hydrate(null, ++generation); });
    return api;
  }
  root.JQAccountCore = Object.freeze({create, keys: KEYS, limits: LIMITS});
})(typeof window !== 'undefined' ? window : globalThis);
