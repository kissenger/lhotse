import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '@pages/admin/sites-editor/unsaved-changes.guard';
import { PageNotFoundComponent } from '@shared/components/page-not-found/page-not-found.component';
import { HomeComponent } from '@pages/home/home.component';
import { MapPageComponent } from '@pages/home/map/map-page.component';
import { AuthGuard } from './auth.guard';
import { AdminSubdomainGuard } from './admin-subdomain.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'blog/:slug', loadComponent: () =>
    import('@pages/home/blog/blog-post-shower/post-shower.component').then((m) => m.PostShowerComponent)},
  { path: 'map', component: MapPageComponent },
  { path: 'dashboard', loadComponent: () =>
    import('@pages/admin/admin.component').then((m) => m.AdminComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'orders', loadComponent: () =>
    import('@pages/admin/orders/orders.component').then((m) => m.OrdersComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'orders/manual/:orderNumber', loadComponent: () =>
    import('@pages/admin/orders/manual-order/manual-order.component').then((m) => m.ManualOrderComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'blogeditor', loadComponent: () =>
    import('@pages/admin/blog-editor/blog-editor.component').then((m) => m.BlogEditorComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'siteseditor', loadComponent: () =>
    import('@pages/admin/sites-editor/sites-editor.component').then((m) => m.SitesEditorComponent), canActivate: [AuthGuard], canDeactivate: [unsavedChangesGuard], data: { noPreload: true }},
  { path: 'adminmap', loadComponent: () =>
    import('@pages/admin/admin-map/admin-map.component').then((m) => m.AdminMapComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'organisations', loadComponent: () =>
    import('@pages/admin/organisations-editor/organisations-editor.component').then((m) => m.OrganisationsEditorComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'login', loadComponent: () =>
    import('@pages/admin/auth/login/login.component').then((m) => m.LoginComponent), canActivate: [AdminSubdomainGuard], data: { noPreload: true }},
  { path: 'privacy-policy', loadComponent: () =>
    import('@pages/privacy-policy/privacy-policy.component').then((m) => m.PrivacyPolicyComponent)},
  { path: 'ai-transparency', loadComponent: () =>
    import('@pages/ai-transparency/ai-transparency.component').then((m) => m.AiTransparencyComponent)},
  { path: '**', component: PageNotFoundComponent}

];