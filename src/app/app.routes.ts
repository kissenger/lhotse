import { Routes } from '@angular/router';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { PostShowerComponent } from '@pages/blog/shower/post-shower.component';
import { PageNotFoundComponent } from '@shared/components/page-not-found/page-not-found.component';
import { MainComponent } from '@pages/main/main.component';

export const routes: Routes = [
  { path: '', component: MainComponent },
  { path: 'blog/:slug', component: PostShowerComponent },
  { path: 'blogeditor', component: BlogEditorComponent },
  { path: '404', component: PageNotFoundComponent },
  { path: '**', component: PageNotFoundComponent}
];