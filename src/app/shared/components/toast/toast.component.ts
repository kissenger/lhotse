import { CommonModule } from '@angular/common';
import { Component, Input, output, OutputEmitterRef } from '@angular/core';
import { SanitizerPipe } from '@shared/pipes/sanitizer.pipe';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, SanitizerPipe],
  providers: [],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})

export class ToastComponent {
  @Input() public message!: string;
  dismiss: OutputEmitterRef<void> = output();
}