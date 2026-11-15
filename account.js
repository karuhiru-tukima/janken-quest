/* Account UI: credentials go straight to Firebase Authentication over HTTPS. */
(() => {
  'use strict';
  const element = document.createElement('section');
  element.id = 'account-panel'; element.className = 'account-start-panel';
  element.setAttribute('aria-labelledby', 'account-title');
  element.innerHTML = `<div class="account-head"><h2 id="account-title">冒険のアカウント</h2></div>
    <section id="account-member" hidden>
      <p class="account-email" id="account-email"></p><p id="account-summary"></p>
      <p class="account-hint">キャラ・進行・所持カード・コインは、このアカウント専用です。</p>
      <p id="account-save-status" role="status"></p>
      <div class="account-actions"><button type="button" id="account-save">今すぐ保存</button><button type="button" id="account-reset-member">パスワード再設定メールを送る</button><button type="button" id="account-logout">ログアウト</button></div>
    </section>
    <section id="account-guest">
      <p class="account-hint">ログインすると、あなた専用の冒険を保存できます。ゲストの進行はこの端末に残ります。</p>
      <div class="account-tabs" role="tablist" aria-label="アカウント操作"><button type="button" role="tab" data-account-mode="login" aria-selected="true">ログイン</button><button type="button" role="tab" data-account-mode="register" aria-selected="false">新規登録</button><button type="button" role="tab" data-account-mode="reset" aria-selected="false">パスワード再設定</button></div>
      <form id="account-form">
        <label for="account-login-email">メールアドレス</label><input id="account-login-email" name="email" type="email" autocomplete="username" maxlength="254" required>
        <div id="account-password-row"><label for="account-password">パスワード</label><input id="account-password" name="password" type="password" autocomplete="current-password" maxlength="128" required><p id="account-password-hint" class="account-hint" hidden>8文字以上で設定してください。</p></div>
        <button class="account-submit" id="account-submit" type="submit">ログインする</button>
      </form>
      <p class="account-hint">パスワードはゲーム内やブラウザの保存データには保管しません。</p>
    </section><p id="account-message" role="status" aria-live="polite"></p>`;
  document.getElementById('boot-start').before(element);
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
    persistence: window.firebase?.auth?.Auth?.Persistence?.SESSION || 'session',
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
  function render() {
    if (!api || !element.isConnected) return;
    const user = api.user;
    $('account-member').hidden = !user; $('account-guest').hidden = !!user;
    $('account-email').textContent = user ? user.email : '';
    $('account-save-status').textContent = api.status;
    const summary = api.summary();
    $('account-summary').textContent = summary ? `${summary.character}・クリア ${summary.cleared} / 50・所持 ${summary.coins} コイン・カード ${summary.cards} 枚` : '';
    $('boot-start').textContent = user ? 'このアカウントで冒険をはじめる' : 'ゲストで冒険をはじめる';
  }
  function showMessage(text, failed = false) { $('account-message').textContent = text; $('account-message').className = failed ? 'account-error' : ''; }
  function setMode(value) {
    mode = value; $('account-password').value = ''; showMessage('');
    $('account-password-row').hidden = mode === 'reset';
    $('account-password').required = mode !== 'reset';
    $('account-password').minLength = mode === 'register' ? 8 : 1;
    $('account-password').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    $('account-password-hint').hidden = mode !== 'register';
    $('account-submit').textContent = {login:'ログインする', register:'新規登録する', reset:'再設定メールを送る'}[mode];
    element.querySelectorAll('[data-account-mode]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.accountMode === mode)));
  }
  function errorMessage(code) {
    if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') return 'パスワードが条件を満たしていません。8文字以上で設定してください。';
    if (code === 'auth/invalid-email') return 'メールアドレスの形式を確認してください。';
    if (code === 'auth/too-many-requests') return '試行回数が多いため、少し待ってからお試しください。';
    if (code === 'auth/network-request-failed') return '通信できませんでした。接続を確認してお試しください。';
    if (code === 'auth/operation-not-allowed' || code === 'auth/unavailable') return '現在ログイン機能に接続できません。しばらくしてからお試しください。';
    if (mode === 'register') return '登録できませんでした。アカウントをお持ちの場合はログインまたはパスワード再設定をお試しください。';
    return 'ログインできませんでした。入力内容を確認するか、パスワードを再設定してください。';
  }
  async function run(operation) {
    if (busy) return;
    busy = true; element.setAttribute('aria-busy', 'true'); showMessage('処理中…');
    $('boot-start').disabled = true;
    element.querySelectorAll('button,input').forEach(control => { control.disabled = true; });
    try { await operation(); }
    catch (error) { showMessage(errorMessage(error && error.code), true); }
    finally {
      $('account-password').value = '';
      busy = false; element.removeAttribute('aria-busy');
      $('boot-start').disabled = false;
      element.querySelectorAll('button,input').forEach(control => { control.disabled = false; });
      render();
    }
  }
  $('boot-start').addEventListener('click', () => { $('account-password').value = ''; });
  element.querySelectorAll('[data-account-mode]').forEach(button => button.onclick = () => setMode(button.dataset.accountMode));
  $('account-form').onsubmit = event => {
    event.preventDefault();
    const email = $('account-login-email').value.trim(), password = $('account-password').value;
    $('account-password').value = '';
    run(async () => {
      if (mode === 'reset') { await api.resetPassword(email); showMessage('アカウントがある場合、再設定メールを送信しました。受信箱と迷惑メールをご確認ください。'); }
      else if (mode === 'register') await api.register(email, password);
      else await api.signIn(email, password);
    });
  };
  $('account-logout').onclick = () => run(() => api.signOut());
  $('account-save').onclick = () => run(async () => { await api.save(); showMessage(api.status); });
  $('account-reset-member').onclick = () => run(async () => { if (api.user?.email) { await api.resetPassword(api.user.email); showMessage('再設定メールを送信しました。メール内のリンクから新しいパスワードを設定できます。'); } });
  window.addEventListener('online', () => api.retry());
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  api.ready.then(render);
})();
