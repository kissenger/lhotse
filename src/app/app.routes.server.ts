import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Server
  },
  {
    path: 'admin/orders/manual/:orderNumber',
    renderMode: RenderMode.Server
  },  
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
