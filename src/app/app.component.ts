import { AfterViewInit, Component, Signal, viewChild, ViewContainerRef} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from '@shared/services/toast.service';

@Component({
  standalone: true,
  providers: [],
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit{

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
