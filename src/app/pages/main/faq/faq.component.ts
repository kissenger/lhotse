import { Component, OnInit } from '@angular/core';
import { ImageService } from '../../../shared/services/image.service';
import { ExternalLinkComponent } from '@shared/components/external-link/external-link.component';

@Component({
  standalone: true,
  imports: [ExternalLinkComponent],
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
