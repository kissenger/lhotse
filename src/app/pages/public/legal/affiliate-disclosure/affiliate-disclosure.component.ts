import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-affiliate-disclosure',
  templateUrl: './affiliate-disclosure.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './affiliate-disclosure.component.css'
})
export class AffiliateDisclosureComponent {}
