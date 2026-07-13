const stage = document.getElementById('loading-stage');
const loading = document.getElementById('wasm-loading');
const app = document.getElementById('stlite-app');

function setStage(text) {
  if (stage) stage.textContent = text;
}

async function boot() {
  try {
    setStage('正在加载本地运行时…');

    // 如果后续已放置 stlite runtime，可在这里接入 window.stlite.mount。
    // 当前仓库提供无外部依赖的浏览器原生 MVP，保证静态服务器打开即可跑通主流程。
    if (window.stlite && typeof window.stlite.mount === 'function') {
      setStage('检测到 stlite runtime；当前仍使用原生 MVP，避免未锁定资源导致启动失败。');
    } else {
      setStage('未检测到 stlite runtime，启动浏览器原生 MVP…');
    }

    const { mountNativePingdouApp } = await import('/assets/app/browser_app.js');
    await mountNativePingdouApp(app);
  } catch (err) {
    console.error(err);
    setStage('初始化失败，请刷新重试或检查本地静态资源是否完整。');
    if (app) {
      app.innerHTML = `<section style="max-width:920px;margin:32px auto;padding:24px;background:white;border-radius:18px;box-shadow:0 12px 40px rgba(15,23,42,.08)">
        <h1>Pingdou 拼豆图生成器</h1>
        <p>应用初始化失败。请确认 <code>/assets/app/browser_app.js</code> 与 <code>/assets/palettes/basic.json</code> 可访问。</p>
      </section>`;
    }
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

boot();
