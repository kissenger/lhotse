import { Pipe, PipeTransform } from '@angular/core';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
    name: 'sanitizer',
    standalone: true,
    pure: true
})

export class SanitizerPipe implements PipeTransform {

  constructor(private _sanitizer: DomSanitizer) { }

  transform(value: string): string {
    return this._sanitizer.sanitize(SecurityContext.HTML, value) ?? '';
  }

}