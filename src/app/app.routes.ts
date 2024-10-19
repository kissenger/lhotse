import { Routes } from '@angular/router';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { PostShowerComponent } from '@pages/blog/shower/post-shower.component';
import { MainComponent } from '@pages/main/main.component';
import { PrivacyComponent } from '@pages/privacy-policy/privacy-policy.component';
import { SubscribeComponent } from '@pages/subscribe/subscribe.component';

export const routes: Routes = [
  { path: '', component: MainComponent },
  { path: 'snorkelling-in-britain/:slug', component: PostShowerComponent },
  { path: 'blog/edit', component: BlogEditorComponent },
  { path: 'privacy-policy', component: PrivacyComponent },
  { path: 'subscribe', component: SubscribeComponent  },
  // { path: '**', redirectTo: ''}
];



