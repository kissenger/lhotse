import { Component, OnInit } from '@angular/core';
import { ImageService } from '../../../shared/services/image.service';
import { NavService } from '../../../shared/services/nav.service';
import { ExtLinkComponent } from '../../../shared/components/ext-link/ext-link.component';

@Component({
  standalone: true,
  imports: [ExtLinkComponent],
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['../main.component.css']
})
export class FAQComponent implements OnInit {

  constructor(
    public images: ImageService,
    public navigate: NavService

  ) { }

  ngOnInit(): void {
  }

}
