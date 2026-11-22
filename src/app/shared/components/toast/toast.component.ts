import { CommonModule } from '@angular/common';
import { Component, Input, output, OutputEmitterRef, ChangeDetectionStrategy } from '@angular/core';
import { SanitizerPipe } from '@shared/pipes/sanitizer.pipe';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, SanitizerPipe],
  templateUrl: './toast.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./toast.component.css']
})

export class ToastComponent {
  @Input() public message!: string;
  dismiss: OutputEmitterRef<void> = output();
}