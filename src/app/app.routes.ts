import { Routes } from '@angular/router';
import { BlogEditorComponent } from '@pages/admin/blog-editor/blog-editor.component';
import { PostShowerComponent } from '@pages/blog-post-shower/post-shower.component';
import { PageNotFoundComponent } from '@shared/components/page-not-found/page-not-found.component';
import { MainComponent } from '@pages/main/main.component';
import { PagesComponent } from '@pages/pages.component';
import { OrdersComponent } from '@pages/admin/orders/orders.component'
import { ManualOrderComponent } from '@pages/admin/orders/manual-order/manual-order.component';
import { LoginComponent } from '@pages/admin/auth/login/login.component';
import { RegisterComponent } from '@pages/admin/auth/register/register.component';
import { AdminComponent } from '@pages/admin/admin.component';
import { AuthGuard } from './auth.guard';

export const routes: Routes = [

  // { path: '', 
  //   component: PagesComponent, 
  //   children: [
      { path: '', pathMatch: 'full', component: MainComponent, 
        data: {menuItems: [
          {name: 'Home',  anchor: 'home'},
          {name: 'About', anchor: 'about-us'},
          // {name: 'Blog',  anchor: 'blog'},
          {name: 'Book',  anchor: 'snorkelling-britain'},
          {name: 'Shop',  anchor: 'shop'},
          {name: 'FAQs',  anchor: 'british-snorkelling-faqs'},
          {name: 'Friends', anchor: 'friends-and-partners'}
        ]}
      },
      { path: 'blog/:slug', component: PostShowerComponent, 
        data: {menuItems: [
          {name: 'Home', anchor: 'home'},
          {name: 'Back to Blogs', anchor: 'blog'}
        ]} 
      },
      { path: 'admin', component: AdminComponent, data: {menuItems: []}, canActivate: [AuthGuard]},
      { path: 'admin/orders', component: OrdersComponent, data: {menuItems: []}, canActivate: [AuthGuard]},
      { path: 'admin/orders/manual/:orderNumber', component: ManualOrderComponent, data: {menuItems: []}, canActivate: [AuthGuard]},      
      { path: 'admin/blogeditor', component: BlogEditorComponent, canActivate: [AuthGuard]},
      { path: 'admin/login', component: LoginComponent },
      { path: 'admin/register', component: RegisterComponent },
      { path: '**', component: PageNotFoundComponent, data: {menuItems: []}}
    // ]
  // }

];