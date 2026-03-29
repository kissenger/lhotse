import { Routes } from '@angular/router';
import { BlogEditorComponent } from '@pages/admin/blog-editor/blog-editor.component';
import { FeaturesEditorComponent } from '@pages/admin/features-editor/features-editor.component';
import { PostShowerComponent } from '@pages/home/blog/blog-post-shower/post-shower.component';
import { PageNotFoundComponent } from '@shared/components/page-not-found/page-not-found.component';
import { HomeComponent } from '@pages/home/home.component';
import { OrdersComponent } from '@pages/admin/orders/orders.component'
import { ManualOrderComponent } from '@pages/admin/orders/manual-order/manual-order.component';
import { LoginComponent } from '@pages/admin/auth/login/login.component';
import { RegisterComponent } from '@pages/admin/auth/register/register.component';
import { AdminComponent } from '@pages/admin/admin.component';
import { MapComponent } from '@pages/home/map/map.component';
import { AuthGuard } from './auth.guard';
import { AdminSubdomainGuard } from './admin-subdomain.guard';
// import { BlogComponent } from '@pages/home/blog/blog.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'home', component: HomeComponent },      
  { path: 'blog/:slug', loadComponent: () =>
    import('@pages/home/blog/blog-post-shower/post-shower.component').then((m) => m.PostShowerComponent )
  },
  { path: 'map', pathMatch: 'full', redirectTo: "#snorkelling-map-of-britain"},
  { path: 'dashboard', component: AdminComponent, canActivate: [AuthGuard]},
  { path: 'orders', component: OrdersComponent, canActivate: [AuthGuard]},
  { path: 'orders/manual/:orderNumber', component: ManualOrderComponent, canActivate: [AuthGuard]},      
  { path: 'blogeditor', component: BlogEditorComponent, canActivate: [AuthGuard]},
  { path: 'featureseditor', component: FeaturesEditorComponent, canActivate: [AuthGuard]},
  { path: 'login', component: LoginComponent, canActivate: [AdminSubdomainGuard] },
  // { path: 'register', component: RegisterComponent },
  { path: '**', component: PageNotFoundComponent}

];