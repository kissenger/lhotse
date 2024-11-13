import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '@shared/components/footer/footer.component';
import { HeaderComponent } from '@shared/components/header/header.component';

@Component({
  standalone: true,
  imports: [HeaderComponent, FooterComponent, RouterOutlet],
  selector: 'app-main',
  templateUrl: './pages.component.html',
  styles: ''
})

export class PagesComponent  {
  constructor() {}
}