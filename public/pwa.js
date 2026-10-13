(() => {
  const install = document.getElementById('install-app');
  const help = document.getElementById('install-help');
  const connection = document.getElementById('connection-status');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let pending;
  if (!standalone && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))) help.hidden = false;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); pending = event;
    if (!standalone) install.hidden = false;
  });
  install.addEventListener('click', async () => {
    if (!pending) return;
    const prompt = pending; pending = null; install.hidden = true;
    try { await prompt.prompt(); await prompt.userChoice; } catch { /* Browser installation remains available. */ }
  });
  window.addEventListener('appinstalled', () => { pending = null; install.hidden = true; help.hidden = true; });
  const updateConnection = () => { connection.hidden = navigator.onLine; };
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  updateConnection();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
        console.warn('Não foi possível ativar a tela offline do Caderno.');
      });
    });
  }
})();
