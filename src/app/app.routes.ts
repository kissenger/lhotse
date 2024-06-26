import { Routes } from '@angular/router';
import { MainComponent } from '../app/pages/main/main.component';
import { PrivacyComponent } from '../app/pages/privacy-policy/privacy-policy.component';
import { BeginnersGuideComponent } from './pages/content/beginners-guide/beginners-guide.component';
import { ContentComponent } from './pages/content/content.component';
import { SubscribeComponent } from './pages/subscribe/subscribe.component';
import { SciencePartOneComponent } from './pages/content/science-part-one/science-part-one.component';

export const routes: Routes = [
  { path: '', component: MainComponent, 
    data: {
      title: 'Snorkelology - British snorkelling for all the family'
    }
  },
  { path: 'snorkelling-in-britain', component: ContentComponent, 
    data: {
      title: 'Snorkelology - Articles and posts',
      keywords: 'articles, posts, instagram, content, insta, news'
    }
  },
  { path: 'snorkelling-in-britain/beginners-guide', component: BeginnersGuideComponent, 
    data: {
      title: 'Snorkelology - Beginners Guide to Snorkelling',
      keywords: 'science, article, post, content'
    }
    },
  { path: 'snorkelling-in-britain/the-science-of-snorkelling-part-1', component: SciencePartOneComponent,
    data: {
      title: 'Snorkelology - The Science of Snorkelling Part 1',
      keywords: 'science, article, post, content'
    }
  },
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



