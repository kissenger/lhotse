import { Routes } from '@angular/router';
import { BlogBrowserComponent } from '@pages/blog/browser/browser.component';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { PostShowerComponent } from '@pages/blog/shower/post-shower.component';
import { MainComponent } from '@pages/main/main.component';
import { PrivacyComponent } from '@pages/privacy-policy/privacy-policy.component';
import { SubscribeComponent } from '@pages/subscribe/subscribe.component';

export const routes: Routes = [
  { path: '', component: MainComponent, 
    data: {
      title: 'Snorkelology - British snorkelling for all the family'
    }
  },
  { path: 'blog/article/:slug', component: PostShowerComponent, 
    data: { 
      title: 'Snorkelling Britain Blog Post',
      keywords: 'blog, content, article, news, latest, snorkelling, britain'
    }
  },
  { path: 'blog/edit', component: BlogEditorComponent, 
    data: { title: 'Snorkelling Britain Blog Editor'}},  
  { path: 'privacy-policy', component: PrivacyComponent,
    data: {
      title: 'Snorkelology - Privacy Policy',
      keywords: 'privacy, policy, privacy-policy'
    }
  },
  { path: 'subscribe', component: SubscribeComponent,
    data: {
      title: 'Snorkelology - Subscribe to our mailing list',
      keywords: 'subscribe, mailing, email, alerts, updates'
    }
  },
  { path: '**', redirectTo: ''}
];



