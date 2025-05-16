import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '@shared/components/footer/footer.component';
import { HeaderComponent } from '@shared/components/header/header.component';
import { AfterViewInit, Component, Signal, viewChild, ViewContainerRef} from '@angular/core';
import { ToastService } from '@shared/services/toast.service';

@Component({
  standalone: true,
  imports: [HeaderComponent, FooterComponent, RouterOutlet],
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrl: './pages.component.css'
})

export class PagesComponent implements AfterViewInit{

  container: Signal<ViewContainerRef | undefined> = viewChild("toaster", {
    read: ViewContainerRef,
  });

  constructor(
    private toaster: ToastService
  ) {}

  ngAfterViewInit(): void {
    // console.log(this.container())
    if (this.container()) {
      this.toaster.init(this.container()!);
    }
  }
  
}
