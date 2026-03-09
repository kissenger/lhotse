
import { ComponentRef, inject, Injectable, NgZone, ViewContainerRef } from '@angular/core';
import { ToastComponent } from '@shared/components/toast/toast.component'

/*
  There are three elements to get toasts working:
  1) This service manages the creation and destruction of toasts 
  2) The toast component which manages the look and feel of the toasts
  3) app.component from which we get the viewContainer, used to insert the toasts - calls init on this service

  Some Refs:
    https://blog.venturemagazine.net/mastering-angular-toast-notifications-a-complete-guide-from-zero-to-hero-33c853bac36f
    https://stackblitz.com/edit/angular-19-portaloutlet-toast-service-njygavfb?file=src%2Ftoast.service.ts
    https://angular.dev/errors/NG0506 <--timeouts cause unstable error, fix is in here
*/

@Injectable({
  providedIn: 'root'
})

export class ToastService {
  ngZone = inject(NgZone);

	viewContainerRef!: ViewContainerRef;

  init(viewContainer: ViewContainerRef): void {
    if (!viewContainer) {
			throw new Error("viewContainerRef needs to be defined!");
		}
		this.viewContainerRef = viewContainer;
  }

  show(message: string, type: 'success' | 'error' | 'warning' = 'warning', duration: number = 8000) {
    let componentRef = this.viewContainerRef.createComponent(ToastComponent);
    this.viewContainerRef.element.nativeElement.appendChild(componentRef.location.nativeElement);
    if (type === 'error') {
      componentRef.instance.message = 'Oops, something didn\'t work out as planned.  The Error was: "'+message+'"<br>If the problem persists, please get in touch.';
    } else {
      componentRef.instance.message = message;
    }
    componentRef.instance.dismiss.subscribe( () => this.close(componentRef) );
    componentRef.location.nativeElement.children[0].classList.add('show', type);
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.close(componentRef)
      }, duration);
    });
  }

  close(cr: ComponentRef<ToastComponent>) {
    cr.location.nativeElement.children[0].classList.remove('show');
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        cr.destroy();
      }, 1000);
    });
  }
}