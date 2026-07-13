(function () {
  // 广告占位 loader：生产环境在此异步挂载 Google AdSense / Ezoic。
  // 不读取用户图片、canvas 或工程状态；失败不得影响主应用。
  const slots = document.querySelectorAll('[data-ad]');
  slots.forEach((slot) => {
    slot.setAttribute('aria-hidden', 'true');
  });
})();
