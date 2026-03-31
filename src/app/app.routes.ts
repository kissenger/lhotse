import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '@pages/admin/features-editor/unsaved-changes.guard';
import { PageNotFoundComponent } from '@shared/components/page-not-found/page-not-found.component';
import { HomeComponent } from '@pages/home/home.component';
import { AuthGuard } from './auth.guard';
import { AdminSubdomainGuard } from './admin-subdomain.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'blog/:slug', loadComponent: () =>
    import('@pages/home/blog/blog-post-shower/post-shower.component').then((m) => m.PostShowerComponent)
  },
  { path: 'map', pathMatch: 'full', redirectTo: "#snorkelling-map-of-britain"},
  { path: 'dashboard', loadComponent: () =>
    import('@pages/admin/admin.component').then((m) => m.AdminComponent), canActivate: [AuthGuard]},
  { path: 'orders', loadComponent: () =>
    import('@pages/admin/orders/orders.component').then((m) => m.OrdersComponent), canActivate: [AuthGuard]},
  { path: 'orders/manual/:orderNumber', loadComponent: () =>
    import('@pages/admin/orders/manual-order/manual-order.component').then((m) => m.ManualOrderComponent), canActivate: [AuthGuard]},
  { path: 'blogeditor', loadComponent: () =>
    import('@pages/admin/blog-editor/blog-editor.component').then((m) => m.BlogEditorComponent), canActivate: [AuthGuard]},
  { path: 'featureseditor', loadComponent: () =>
    import('@pages/admin/features-editor/features-editor.component').then((m) => m.FeaturesEditorComponent), canActivate: [AuthGuard], canDeactivate: [unsavedChangesGuard]},
  { path: 'adminmap', loadComponent: () =>
    import('@pages/admin/admin-map/admin-map.component').then((m) => m.AdminMapComponent), canActivate: [AuthGuard]},
  { path: 'login', loadComponent: () =>
    import('@pages/admin/auth/login/login.component').then((m) => m.LoginComponent), canActivate: [AdminSubdomainGuard]},
  { path: '**', component: PageNotFoundComponent}

];