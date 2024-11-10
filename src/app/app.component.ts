import { Component, Inject} from '@angular/core';
import { HeaderComponent } from '@shared/components/header/header.component';
import { FooterComponent } from '@shared/components/footer/footer.component';
import { RouterOutlet } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
// import { Router } from 'express';


@Component({
  standalone: true,
  providers: [Router],
  imports: [HeaderComponent, FooterComponent , CommonModule, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  public showHeaderFooter: boolean;

  constructor(
    @Inject(DOCUMENT) private _document: Document,
    private _router: Router
  ) {
    let _window = _document.defaultView;
    this.showHeaderFooter = _window?.location.href.match('blogeditor') === null;
    this._router.events.subscribe(console.log)
  }


}
