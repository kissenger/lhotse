import { Location, DOCUMENT } from '@angular/common';
import { EventEmitter, Inject, Injectable } from '@angular/core';
import { Router, NavigationEnd, Event } from '@angular/router';

@Injectable({
  providedIn: 'root'
})

export class NavService {

  public end = new EventEmitter<string>();
  private window;

  constructor(
    private router: Router,
    private location: Location,
    @Inject(DOCUMENT) private _document:Document
  ) {
    this.window = _document.defaultView;
    this.router.events.subscribe( (event: Event) => {
      if (event instanceof NavigationEnd) {
        this.end.emit(this.window!.location.pathname);
      }
    });
  }

  to(destination: string) {

    // If destination is an element on the current page, the scroll to it

    if (this._document.getElementById(destination)) {
      document.getElementById(destination)?.scrollIntoView({
        behavior: 'smooth'
      });
    }

    // If destination is an external link, navigate to it 
    else if (destination.includes('http')) {
      this.window!.location.href = destination;
    } 

    // Else route internally and scroll to top of screen when complete
    else {
      this.router.navigate([destination]).then( () => {
        this._document.getElementById('container')?.scrollTo({
          top: 0,
          left: 0,
        });
      })
    }
  }

  back() {
    this.location.back();
  }

}
