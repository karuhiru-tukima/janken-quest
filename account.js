/* Account UI: credentials go straight to Firebase Authentication over HTTPS. */
(() => {
  'use strict';
  const element = document.createElement('section');
  element.id = 'account-panel'; element.className = 'account-start-panel';
  element.setAttribute('aria-labelledby', 'account-title');
  element.innerHTML = `<div class="account-head"><h2 id="account-title">冒険のアカウント</h2><button type="button" id="account-close" aria-label="アカウントを閉じる" hidden>×</button></div>
    <section id="account-member" hidden>
      <p class="account-email" id="account-email"></p><p id="account-summary"></p>
      <p class="account-hint">キャラ・進行・所持カード・コインは、このアカウント専用です。</p>
      <p id="account-save-status" role="status"></p>
      <section id="account-import" hidden>
        <button type="button" id="account-import-open">この端末のゲストデータを引き継ぐ</button>
        <div id="account-import-confirm" hidden>
          <p id="account-guest-summary" class="account-hint"></p>
          <p class="account-hint">このアカウントの進行・カード・コインを、ゲストのデータに置き換えます。両方のデータは合算されません。元のゲストデータはこの端末に残ります。</p>
          <div class="account-actions"><button type="button" id="account-import-yes">ゲストのデータで引き継ぐ</button><button type="button" id="account-import-cancel">やめる</button></div>
        </div>
      </section>
      <div class="account-actions"><button type="button" id="account-save">今すぐ保存</button><button type="button" id="account-reset-member">パスワード再設定メールを送る</button><button type="button" id="account-logout">ログアウト</button></div>
    </section>
    <section id="account-guest">
      <p class="account-hint" id="account-guest-hint">ゲストの冒険を連携するには、ログイン・新規登録後に「この端末のゲストデータを引き継ぐ」を押してください。ゲーム中は歯車 → アカウントから開けます。</p>
      <div class="account-tabs" role="tablist" aria-label="アカウント操作"><button type="button" role="tab" data-account-mode="login" aria-selected="true">ログイン</button><button type="button" role="tab" data-account-mode="register" aria-selected="false">新規登録</button><button type="button" role="tab" data-account-mode="reset" aria-selected="false">パスワード再設定</button></div>
      <form id="account-form">
        <label for="account-login-email">メールアドレス</label><input id="account-login-email" name="email" type="email" autocomplete="username" maxlength="254" required>
        <div id="account-password-row"><label for="account-password">パスワード</label><input id="account-password" name="password" type="password" autocomplete="current-password" maxlength="128" required><p id="account-password-hint" class="account-hint" hidden>8文字以上で設定してください。</p></div>
        <button class="account-submit" id="account-submit" type="submit">ログインする</button>
        <p class="account-hint" id="account-auto-link-hint" hidden>ここで新規登録すると、いまのゲストの進行・コイン・カードを自動で引き継ぎます。</p>
      </form>
      <p class="account-hint">登録済みのメールアドレスで重複登録はできません。アカウントを削除すると、同じメールアドレスで新しく登録できます。</p>
      <p class="account-hint">このブラウザではログイン状態を保持します。ログアウトしたとき、または90日間利用しなかったときに再ログインが必要です。パスワードはゲーム内に保存しません。</p>
    </section><p id="account-message" role="status" aria-live="polite"></p>`;
  document.getElementById('boot-start').before(element);
  const dialog = document.createElement('dialog'); dialog.id = 'account-dialog';
  dialog.setAttribute('aria-labelledby', 'account-title'); document.body.append(dialog);
  function closePanel() { if (busy) return; $('account-password').value = ''; dialog.close(); }
  dialog.addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) closePanel(); });
  const cover = document.createElement('div'); cover.id = 'account-switch-cover'; cover.hidden = true;
  cover.setAttribute('role', 'status'); cover.textContent = 'アカウントを切り替えています…'; document.body.append(cover);
  const $ = id => document.getElementById(id);
  let auth = null, mode = 'login', busy = false;
  try {
    if (window.firebase) {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth();
    }
  } catch {}
  let local;
  try { local = window.localStorage; } catch { local = {getItem:()=>null,setItem(){throw new Error('Storage unavailable');},removeItem(){}}; }
  let api;
  api = JQAccountCore.create({
    auth, local, database: () => firebase.database(),
    persistence: window.firebase?.auth?.Auth?.Persistence?.LOCAL || 'local',
    timestamp: () => firebase.database.ServerValue.TIMESTAMP,
    reload: () => location.reload(),
    mask(on) {
      cover.hidden = !on;
      element.style.visibility = on ? 'hidden' : '';
      const game = $('wrap'); if (game) game.inert = on;
    },
    onChange: render,
  });
  window.JQAccount = api;
  api.openPanel = async () => {
    await api.ready;
    if (!dialog.open) {
      dialog.append(element); $('account-close').hidden = false;
      render(); dialog.showModal(); setMode(mode); $('account-close').focus();
    }
    api.save();
  };
  function render() {
    if (!api || !element.isConnected) return;
    const user = api.user;
    $('account-member').hidden = !user; $('account-guest').hidden = !!user;
    $('account-email').textContent = user ? user.email : '';
    $('account-save-status').textContent = api.status;
    const guest = api.guestData();
    $('account-import').hidden = !user || !Object.keys(guest).length;
    let progress = {}, cards = {};
    try { progress = JSON.parse(guest['jq-progress'] || '{}') || {}; } catch {}
    try { cards = JSON.parse(guest['jq-cards'] || '{}') || {}; } catch {}
    $('account-guest-summary').textContent = `ゲストの進行：クリア ${Array.isArray(progress.cleared) ? progress.cleared.length : 0} / 50・所持 ${Number(cards.coins) || 0} コイン・カード ${Array.isArray(cards.cards) ? cards.cards.length : 0} 枚`;
    const summary = api.summary();
    $('account-summary').textContent = summary ? `${summary.character}・クリア ${summary.cleared} / 50・所持 ${summary.coins} コイン・カード ${summary.cards} 枚` : '';
    if ($('boot-start')) $('boot-start').textContent = user ? 'このアカウントで冒険をはじめる' : 'ゲストで冒険をはじめる';
  }
  function showMessage(text, failed = false) { $('account-message').textContent = text; $('account-message').className = failed ? 'account-error' : ''; }
  function setMode(value) {
    mode = value; $('account-password').value = ''; showMessage('');
    $('account-guest-hint').textContent = dialog.open
      ? 'ここで新規登録すると、いまのゲストの冒険を自動で引き継ぎます。登録済みのアカウントへは、ログイン後に引き継ぎ内容を確認して連携できます。'
      : 'ゲストの冒険は、ゲーム中の歯車 → アカウントから新規登録すると自動で引き継げます。登録済みアカウントへは、ログイン後に「この端末のゲストデータを引き継ぐ」を押してください。';
    $('account-password-row').hidden = mode === 'reset';
    $('account-password').required = mode !== 'reset';
    $('account-password').minLength = mode === 'register' ? 8 : 1;
    $('account-password').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    $('account-password-hint').hidden = mode !== 'register';
    $('account-auto-link-hint').hidden = mode !== 'register' || !dialog.open;
    $('account-submit').textContent = {login:'ログインする', register:'新規登録する', reset:'再設定メールを送る'}[mode];
    element.querySelectorAll('[data-account-mode]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.accountMode === mode)));
  }
  function errorMessage(code) {
    if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') return 'パスワードが条件を満たしていません。8文字以上で設定してください。';
    if (code === 'auth/invalid-email') return 'メールアドレスの形式を確認してください。';
    if (code === 'auth/email-already-in-use') return 'このメールアドレスは登録済みです。ログインするか、パスワードを再設定してください。';
    if (code === 'auth/too-many-requests') return '試行回数が多いため、少し待ってからお試しください。';
    if (code === 'auth/network-request-failed') return '通信できませんでした。接続を確認してお試しください。';
    if (code === 'game/no-guest-data') return '引き継げるゲストデータがありません。';
    if (code === 'game/import-failed') return '引き継ぎを保存できませんでした。データは変更していません。接続を確認してお試しください。';
    if (code === 'auth/operation-not-allowed' || code === 'auth/unavailable') return '現在ログイン機能に接続できません。しばらくしてからお試しください。';
    if (mode === 'register') return '登録できませんでした。アカウントをお持ちの場合はログインまたはパスワード再設定をお試しください。';
    return 'ログインできませんでした。入力内容を確認するか、パスワードを再設定してください。';
  }
  async function run(operation) {
    if (busy) return;
    busy = true; element.setAttribute('aria-busy', 'true'); showMessage('処理中…');
    if ($('boot-start')) $('boot-start').disabled = true;
    element.querySelectorAll('button,input').forEach(control => { control.disabled = true; });
    try { await operation(); }
    catch (error) { showMessage(errorMessage(error && error.code), true); }
    finally {
      $('account-password').value = '';
      busy = false; element.removeAttribute('aria-busy');
      if ($('boot-start')) $('boot-start').disabled = false;
      element.querySelectorAll('button,input').forEach(control => { control.disabled = false; });
      render();
    }
  }
  $('account-close').onclick = closePanel;
  $('boot-start').addEventListener('click', () => {
    $('account-password').value = '';
    // Keep one account form alive after the title screen is removed.
    dialog.append(element); $('account-close').hidden = false;
  });
  element.querySelectorAll('[data-account-mode]').forEach(button => button.onclick = () => setMode(button.dataset.accountMode));
  $('account-form').onsubmit = event => {
    event.preventDefault();
    const email = $('account-login-email').value.trim(), password = $('account-password').value;
    $('account-password').value = '';
    run(async () => {
      if (mode === 'reset') { await api.resetPassword(email); showMessage('アカウントがある場合、再設定メールを送信しました。受信箱と迷惑メールをご確認ください。'); }
      else if (mode === 'register') await (dialog.open ? api.registerWithGuest(email, password) : api.register(email, password));
      else await api.signIn(email, password);
    });
  };
  $('account-logout').onclick = () => run(() => api.signOut());
  $('account-import-open').onclick = () => { $('account-import-confirm').hidden = false; };
  $('account-import-cancel').onclick = () => { $('account-import-confirm').hidden = true; };
  $('account-import-yes').onclick = () => run(() => api.importGuest());
  $('account-save').onclick = () => run(async () => { await api.save(); showMessage(api.status); });
  $('account-reset-member').onclick = () => run(async () => { if (api.user?.email) { await api.resetPassword(api.user.email); showMessage('再設定メールを送信しました。メール内のリンクから新しいパスワードを設定できます。'); } });
  window.addEventListener('online', () => api.retry());
  ['pointerdown', 'keydown'].forEach(name => window.addEventListener(name, () => api.touch(), {passive:true}));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) api.touch(); });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  api.ready.then(render);
})();
