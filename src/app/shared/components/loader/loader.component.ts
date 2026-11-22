import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./loader.component.css']
})
export class LoaderComponent{
  @Input() public loadingState: 'loading' | 'failed' = 'loading';   
  @Output() public retry = new EventEmitter<void>();
}
