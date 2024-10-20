import { Component, OnInit } from '@angular/core';
import { ImageService } from '../../../shared/services/image.service';
import { ExternalLinkComponent } from '@shared/components/external-link/external-link.component';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [ExternalLinkComponent, RouterLink],
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['../main.component.css']
})
export class FAQComponent implements OnInit {

  constructor(
    public images: ImageService

  ) { }

  ngOnInit(): void {
  }

}
