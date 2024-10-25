import { Routes } from '@angular/router';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { PostShowerComponent } from '@pages/blog/shower/post-shower.component';
import { MainComponent } from '@pages/main/main.component';
import { PrivacyComponent } from '@pages/privacy-policy/privacy-policy.component';

export const routes: Routes = [
  { path: '', component: MainComponent },
  { path: 'blog/:slug', component: PostShowerComponent },
  { path: 'blogeditor', component: BlogEditorComponent, data: {suppressHeaderFooter: true} },
  { path: 'privacy-policy', component: PrivacyComponent },
  { path: '**', redirectTo: ''}
];



