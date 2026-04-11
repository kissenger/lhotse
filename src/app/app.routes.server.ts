import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Server
  },
  {
    path: 'dashboard',
    renderMode: RenderMode.Client
  },
  {
    path: 'login',
    renderMode: RenderMode.Client
  },
  {
    path: 'blogeditor',
    renderMode: RenderMode.Client
  },
  {
    path: 'siteseditor',
    renderMode: RenderMode.Client
  },
  {
    path: 'orders',
    renderMode: RenderMode.Client
  },
  {
    path: 'orders/manual/:orderNumber',
    renderMode: RenderMode.Client
  },
  {
    path: 'map',
    renderMode: RenderMode.Server
  },
  {
    path: 'adminmap',
    renderMode: RenderMode.Client
  },
  {
    path: 'organisations',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
