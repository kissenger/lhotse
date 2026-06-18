import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '@pages/admin/sites-editor/unsaved-changes.guard';
import { organisationsUnsavedChangesGuard } from '@pages/admin/organisations-editor/organisations-unsaved-changes.guard';
import { PageNotFoundComponent } from '@shared/components/page-not-found/page-not-found.component';
import { HomeComponent } from '@pages/public/main/home/home.component';
import { AuthGuard } from './auth.guard';
import { AdminSubdomainGuard } from './admin-subdomain.guard';

const loadMapPage = () => import('@pages/public/main/map/map-page.component').then((m) => m.MapPageComponent);

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'articles', loadComponent: () =>
    import('@pages/public/main/article/article-page.component').then((m) => m.ArticlePageComponent)},
  { path: 'articles/section/:sectionSlug', loadComponent: () =>
    import('@pages/public/main/article/article-page.component').then((m) => m.ArticlePageComponent)},
  { path: 'articles/:slug', loadComponent: () =>
    import('@pages/public/main/article/article-post-shower/post-shower.component').then((m) => m.PostShowerComponent)},
  { path: 'snorkelling-britain', loadComponent: () =>
    import('@pages/public/main/book/book-page.component').then((m) => m.BookPageComponent)},
  { path: 'shop', loadComponent: () =>
    import('@pages/public/main/shop/shop-page.component').then((m) => m.ShopPageComponent)},
  { path: 'faq', loadComponent: () =>
    import('@pages/public/main/faq/faq-page.component').then((m) => m.FaqPageComponent)},
  { path: 'faqs', redirectTo: 'faq', pathMatch: 'full' },
  { path: 'map', loadComponent: loadMapPage },
  { path: 'map/:country', loadComponent: loadMapPage },
  { path: 'map/:country/:county', loadComponent: loadMapPage },
  { path: 'map/:country/:county/:siteName', loadComponent: loadMapPage },
  { path: 'admin', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () =>
    import('@pages/admin/admin.component').then((m) => m.AdminComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'orders', loadComponent: () =>
    import('@pages/admin/orders/orders.component').then((m) => m.OrdersComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'orders/manual/:orderNumber', loadComponent: () =>
    import('@pages/admin/orders/manual-order/manual-order.component').then((m) => m.ManualOrderComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'articleeditor', loadComponent: () =>
    import('@pages/admin/article-editor/article-editor.component').then((m) => m.ArticleEditorComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'siteseditor', loadComponent: () =>
    import('@pages/admin/sites-editor/sites-editor.component').then((m) => m.SitesEditorComponent), canActivate: [AuthGuard], canDeactivate: [unsavedChangesGuard], data: { noPreload: true }},
  { path: 'adminmap', loadComponent: () =>
    import('@pages/admin/admin-map/admin-map.component').then((m) => m.AdminMapComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'organisations', loadComponent: () =>
    import('@pages/admin/organisations-editor/organisations-editor.component').then((m) => m.OrganisationsEditorComponent), canActivate: [AuthGuard], canDeactivate: [organisationsUnsavedChangesGuard], data: { noPreload: true }},
  { path: 'county-descriptions', loadComponent: () =>
    import('@pages/admin/county-descriptions-editor/county-descriptions-editor.component').then((m) => m.CountyDescriptionsEditorComponent), canActivate: [AuthGuard], data: { noPreload: true }},
  { path: 'login', loadComponent: () =>
    import('@pages/admin/auth/login/login.component').then((m) => m.LoginComponent), canActivate: [AdminSubdomainGuard], data: { noPreload: true }},
  { path: 'privacy-policy', loadComponent: () =>
    import('@pages/public/legal/privacy-policy/privacy-policy.component').then((m) => m.PrivacyPolicyComponent)},
  { path: 'affiliate-disclosure', loadComponent: () =>
    import('@pages/public/legal/affiliate-disclosure/affiliate-disclosure.component').then((m) => m.AffiliateDisclosureComponent)},
  { path: 'ai-transparency', loadComponent: () =>
    import('@pages/public/legal/ai-transparency/ai-transparency.component').then((m) => m.AiTransparencyComponent)},
  { path: '**', component: PageNotFoundComponent}

];