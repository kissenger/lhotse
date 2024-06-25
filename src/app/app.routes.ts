import { Routes } from '@angular/router';
import { MainComponent } from '../app/pages/main/main.component';
import { PrivacyComponent } from '../app/pages/privacy-policy/privacy-policy.component';
import { BeginnersGuideComponent } from './pages/content/beginners-guide/beginners-guide.component';
import { ContentComponent } from './pages/content/content.component';
import { SubscribeComponent } from './pages/subscribe/subscribe.component';
import { SciencePartOneComponent } from './pages/content/science-part-one/science-part-one.component';

export const routes: Routes = [
  { path: '', component: MainComponent},
  { path: 'snorkelling-in-britain', component: ContentComponent},
  { path: 'snorkelling-in-britain/beginners-guide', component: BeginnersGuideComponent},
  { path: 'snorkelling-in-britain/the-science-of-snorkelling-part-1', component: SciencePartOneComponent},
  { path: 'privacy-policy', component: PrivacyComponent},
  { path: 'subscribe', component: SubscribeComponent},
  { path: '**', redirectTo: ''}
];
