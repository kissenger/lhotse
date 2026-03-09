import { Routes } from '@angular/router';
import { BlogEditorComponent } from '@pages/admin/blog-editor/blog-editor.component';
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
// import { BlogComponent } from '@pages/home/blog/blog.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'home', component: HomeComponent },      
  { path: 'blog/:slug', loadComponent: () =>
    import('@pages/home/blog/blog-post-shower/post-shower.component').then((m) => m.PostShowerComponent )
  },
  { path: 'map', pathMatch: 'full', redirectTo: "#snorkelling-map-of-britain"},
  { path: 'admin', component: AdminComponent, canActivate: [AuthGuard]},
  { path: 'admin/orders', component: OrdersComponent, canActivate: [AuthGuard]},
  { path: 'admin/orders/manual/:orderNumber', component: ManualOrderComponent, canActivate: [AuthGuard]},      
  { path: 'admin/blogeditor', component: BlogEditorComponent, canActivate: [AuthGuard]},
  { path: 'admin/login', component: LoginComponent },
  // { path: 'admin/register', component: RegisterComponent },
  { path: '**', component: PageNotFoundComponent}

];