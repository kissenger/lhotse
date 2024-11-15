import { ScreenService } from '@shared/services/screen.service';
import { Component} from '@angular/core';

@Component({
  standalone: true,
  imports: [],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent{

  public fullYear;

  constructor(
    public screen: ScreenService,
  ) { 
    this.fullYear = new Date().getFullYear();
  }
}
