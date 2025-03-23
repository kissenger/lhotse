import { NgClass } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from "@angular/forms";

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [NgClass, FormsModule],  
  providers: [], 
  templateUrl: './manual-order.component.html',
  styleUrl: './manual-order.component.css'
})

export class ManualOrderComponent  {

  
  constructor(
  ) {}
    
  async ngOnInit() {
  }


}