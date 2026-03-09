import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
        name: 'kebaber',
        standalone: true,
        pure: true
    })

/*
    Converts a sentance string to lower case kebab style, with special characters removed
    eg: 'This is a (very instructive) example string' --> this-is-a-very-instructive-example-string
*/

export class KebaberPipe implements PipeTransform {
  transform(value: string): string {
    return value.replaceAll(/[^\p{L}\d\s]+/gu, '').trim().replaceAll(' ', '-').toLowerCase();
  }
}