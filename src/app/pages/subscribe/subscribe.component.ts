import { Component, Inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { HttpService } from '../../shared/services/http.service';
import { NavService } from '../../shared/services/nav.service';
import { FormsModule } from '@angular/forms';
import { DOCUMENT } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-subscribe',
  templateUrl: './subscribe.component.html',
  styleUrls: ['./subscribe.component.css'],
  imports: [FormsModule]
})
export class SubscribeComponent implements OnDestroy {

  public email: string = '';
  public footerHeight: number | undefined;

  private _httpSubs: Subscription | undefined;
  private _window;

  constructor(
    public navigate: NavService,
    private _http: HttpService,
    @Inject(DOCUMENT) private _document:Document
    ) {
      this._window = _document.defaultView;
    }

  onSubmit() {
    this._document.body.style.cursor = "wait";
    let data = {email: this.email};
    this._httpSubs = this._http.storeEmail(data).subscribe( {
      next: (result: any) => {
        this._window!.alert("Success! Your email address was saved ... We'll be in touch.");
        this._document.body.style.cursor = "default";
        this.email = "";
      },
      error: (error: any ) => {
        window.alert("Oops, something didn't work out.  Please try again.");
        this._document.body.style.cursor = "default";
        console.log(error);
      }
    });

  }

  ngOnDestroy() {
    this._httpSubs?.unsubscribe();
  }


}
