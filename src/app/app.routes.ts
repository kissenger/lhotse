import { Routes } from '@angular/router';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { PostShowerComponent } from '@pages/blog/shower/post-shower.component';
import { PageNotFoundComponent } from '@shared/components/page-not-found/page-not-found.component';
import { MainComponent } from '@pages/main/main.component';
import { PagesComponent } from '@pages/pages.component';

export const routes: Routes = [

  { path: 'blogeditor', component: BlogEditorComponent },

  { path: '', 
    component: PagesComponent, 
    children: [
      { path: '', pathMatch: 'full', component: MainComponent, data: {menuItems: ['Home', 'About', 'Explore', 'Book', 'FAQs', 'Friends']} },
      { path: 'blog/:slug', component: PostShowerComponent, data: {menuItems: ['Home', 'About', 'Explore', 'Book', 'FAQs', 'Friends']} },
      { path: '**', component: PageNotFoundComponent, data: {menuItems: []}}
    ]
  }

];