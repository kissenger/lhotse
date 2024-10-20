import { ScreenService } from '../../services/screen.service';
import { Component} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExternalLinkComponent } from "../external-link/external-link.component";

@Component({
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, ExternalLinkComponent],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent{

  public fullYear?: number;

  constructor(
    public screen: ScreenService,
  ) { 

    this.fullYear = new Date().getFullYear();

  }
}
