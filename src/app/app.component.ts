import { Component, Inject} from '@angular/core';
import { HeaderComponent } from '@shared/components/header/header.component';
import { FooterComponent } from '@shared/components/footer/footer.component';
import { RouterOutlet } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';


@Component({
  standalone: true,
  imports: [HeaderComponent, FooterComponent, RouterOutlet, CommonModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  public showHeaderFooter: boolean;

  constructor(
    @Inject(DOCUMENT) private _document: Document
  ) {
    let _window = _document.defaultView;
    this.showHeaderFooter = _window?.location.href.match('blogeditor') === null;
  }


}
