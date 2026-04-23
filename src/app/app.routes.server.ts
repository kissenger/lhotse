import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Server
  },
  {
    path: 'home',
    renderMode: RenderMode.Server
  },
  {
    path: 'privacy-policy',
    renderMode: RenderMode.Server
  },
  {
    path: 'ai-transparency',
    renderMode: RenderMode.Server
  },
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
    path: 'map/:country',
    renderMode: RenderMode.Server
  },
  {
    path: 'map/:country/:county',
    renderMode: RenderMode.Server
  },
  {
    path: 'map/:country/:county/:siteName',
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
    renderMode: RenderMode.Server,
    status: 404
  }
];
