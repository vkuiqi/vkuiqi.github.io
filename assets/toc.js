(function () {
  function buildToc() {
    var old = document.getElementById('side-toc');
    if (old) old.parentNode.removeChild(old);

    var sec = document.querySelector('.markdown-section');
    if (!sec) return;

    var hs = sec.querySelectorAll('h2, h3');
    if (hs.length < 3) return;

    var box = document.createElement('nav');
    box.id = 'side-toc';

    var head = document.createElement('p');
    head.className = 'st-head';
    head.textContent = '本页目录';
    box.appendChild(head);

    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (!h.id) h.id = 'toc-h-' + i;
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.className = h.tagName === 'H3' ? 'st-lv3' : 'st-lv2';
      a.setAttribute('data-target', h.id);
      box.appendChild(a);
    }

    box.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      e.preventDefault();
      var t = document.getElementById(a.getAttribute('data-target'));
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.body.appendChild(box);
    watch(Array.prototype.slice.call(box.querySelectorAll('a')), hs);
  }

  var io = null;
  function watch(links, hs) {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) return;
    var map = {};
    for (var i = 0; i < hs.length; i++) map[hs[i].id] = links[i];
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('on'); });
        var a = map[en.target.id];
        if (a) a.classList.add('on');
      });
    }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });
    hs.forEach(function (h) { io.observe(h); });
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(function (hook) {
    hook.doneEach(buildToc);
  });
})();
