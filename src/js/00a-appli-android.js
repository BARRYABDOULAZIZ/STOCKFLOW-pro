  // ================= Application Android (Play Store) =================
  // L'application Android ouvre ce site en plein écran (Trusted Web Activity) avec l'adresse « /?app=android ».
  // On le repère ici, et on le garde pour cet onglet seulement (sessionStorage) :
  // le même site ouvert dans Chrome à côté reste en mode « site web ».
  const ANDROID_APP = (function () {
    let on = false;
    try {
      const p = new URLSearchParams(location.search);
      if (p.get('app') === 'android' || /^android-app:\/\/com\.boromboutik\.app/.test(document.referrer || '')) sessionStorage.setItem('sf_android_app', '1');
      on = sessionStorage.getItem('sf_android_app') === '1';
      if (p.has('app')) { p.delete('app'); const q = p.toString(); history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash); }
    } catch (e) {}
    if (on) document.documentElement.classList.add('android-app');
    return on;
  })();
