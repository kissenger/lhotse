import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShopService } from '@shared/services/shop.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-order-outcome',
  templateUrl: './order-outcome.component.html',
  styleUrls: ['./order-outcome.component.css']
})

export class OrderOutcomeComponent {
  
  constructor(
    public shop: ShopService,
  ) {}

}
