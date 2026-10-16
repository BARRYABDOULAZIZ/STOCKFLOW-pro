(function () {
  var nav = document.querySelector('nav.tabs');
  var bar = document.getElementById('bottomBar');
  if (!nav || !bar) return;
  var more = document.getElementById('bbMore');
  var goBtns = bar.querySelectorAll('[data-go]');
  function sync() {
    var active = nav.querySelector('button.active');
    var activeTab = active ? active.dataset.tab : '';
    var primary = false;
    goBtns.forEach(function (b) {
      var src = nav.querySelector('button[data-tab="' + b.dataset.go + '"]');
      b.style.display = (src && src.style.display === 'none') ? 'none' : '';
      var on = b.dataset.go === activeTab;
      b.classList.toggle('active', on);
      if (on) primary = true;
    });
    more.classList.toggle('active', !primary && !!activeTab);
  }
  function setMenu(open) { document.body.classList.toggle('menu-open', open); }
  goBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var src = nav.querySelector('button[data-tab="' + b.dataset.go + '"]');
      setMenu(false);
      if (src) src.click();
    });
  });
  more.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  document.getElementById('menuBackdrop').addEventListener('click', function () { setMenu(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('button')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  new MutationObserver(sync).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
  sync();
})();
