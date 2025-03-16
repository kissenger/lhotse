import { Routes } from '@angular/router';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { PostShowerComponent } from '@pages/blog/shower/post-shower.component';
import { PageNotFoundComponent } from '@shared/components/page-not-found/page-not-found.component';
import { MainComponent } from '@pages/main/main.component';
import { PagesComponent } from '@pages/pages.component';
import { OrdersComponent } from '@pages/orders/orders.component'
// import { OrderOutcomeComponent } from '@pages/shop/order-outcome/order-outcome.component';
// import { BasketComponent } from '@pages/shop/basket/basket.component';

export const routes: Routes = [

  { path: 'blogeditor', component: BlogEditorComponent },

  { path: '', 
    component: PagesComponent, 
    children: [
      { path: '', pathMatch: 'full', component: MainComponent, 
        data: {menuItems: [
          {name: 'Home',  anchor: 'home'},
          {name: 'About', anchor: 'about-us'},
          {name: 'Blog',  anchor: 'blog'},
          {name: 'Book',  anchor: 'snorkelling-britain'},
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
      { path: 'orders', component: OrdersComponent, data: {menuItems: []}},
      { path: '**', component: PageNotFoundComponent, data: {menuItems: []}}
    ]
  }

];