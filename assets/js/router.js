export class Router {
  constructor(){ this.routes = new Map(); }
  add(path, fn){ this.routes.set(path, fn); return this; }
  start(){
    const run = () => {
      const path = location.hash.replace('#','') || '/engine';
      const fn = this.routes.get(path) || this.routes.get('/engine');
      document.querySelectorAll('.sidebar a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${path}`));
      fn?.();
    };
    addEventListener('hashchange', run);
    run();
  }
}
