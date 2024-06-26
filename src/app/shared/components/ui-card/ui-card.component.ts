import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { NavService } from '../../services/nav.service';
import { ImageService } from '../../services/image.service';
import { ExtLinkComponent } from '../ext-link/ext-link.component';

@Component({
  standalone: true,
  imports: [NgOptimizedImage, CommonModule, ExtLinkComponent],
  selector: 'app-ui-card',
  template: `
    <a href={{link}} class="ui-card">
      <div class="ui-card-photo">
        <img
          ngSrc="{{imageURL}}"
          alt="{{text}}"
          height="300"
          width="300"
        />
        <div class="ui-card-category-overlay" [ngClass]="{'instagram': category=='Instagram', 'article': category=='Article'}">{{category}}</div>
        <div class="ui-card-header-overlay">{{header}}</div>
      </div>

      <div class="ui-card-bottom">
        @if (timestamp==='') {
          <span class="ui-card-date">{{timestamp | date: "dd MMMM YYYY"}}</span>
        } @else {
          <span class="ui-card-date">Snorkelology</span>
        }
        <div class="ui-card-text stealth-html-link">{{text}}</div>
        <div class="ui-card-footer">
          @if (category==='Instagram') {
            <app-ext-link link="{{link}}" text="Read more on Instagram"></app-ext-link>
          } @else {
            <a class="ext-link html-link" (click)="navigate.to(link)" role="link">Read more...</a>
          }
        </div>
      </div>
   </a>
  `,
  styleUrls: ['./ui-card.component.css'],
  encapsulation: ViewEncapsulation.None,
})

export class UICardComponent {
  @Input() public link = '';
  @Input() public imageURL = '';
  @Input() public text = '';
  @Input() public category = '';
  @Input() public timestamp = '';
  @Input() public header = '';

  constructor(
    public navigate: NavService,
    public images: ImageService
  ) {}
}
