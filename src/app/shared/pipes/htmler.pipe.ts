import { output, Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'htmler',
    standalone: true,
    pure: true
})

/*
    Converts a paragraph of text into html for insertion into blog div:
        - Splits by end of line char and wraps each in <p> tags
        - Search for link string in each paragraph, and insert relevant <a> tags
        - Link string in the form [link:text,link], eg [link:BSAC,https:www.bsac.com]
        - List in the form [list:item1,item2,item3]
*/

export class HtmlerPipe implements PipeTransform {
    constructor() {}
    
    transform(rawString: string): string {
        let outputString = this.insertLinks(rawString);
        outputString = this.insertBlockQuotes(outputString);
        outputString = this.insertParagraphs(outputString);
        outputString = this.insertUnorderedList(outputString);
        return outputString;
    }

    insertLinks(input: string): string {
      return input.split(/\[link:([^\][]*)]/).map( (s, i) => {
        if (i % 2 == 0) {
          return s;
        } else {
          const [text, link] = s.split(',');
          return `<a href="${link}">${text}</a>`
        } 
      }).join('');
    }

    insertUnorderedList(input: string): string {
      return input.split(/\[list:(.*)\]/).map( (s, i) => {
        if (i % 2 == 0) {
          return s;
        } else {
          return `<ul>${s.split(',').map(li=>`<li>${li}</li>`).join('')}</ul>`
        } 
      }).join('');
    }

    insertBlockQuotes(input: string): string {
      return input.split(/\[blockquote:(.*)\]/).map( (s, i) => {
        if (i % 2 == 0) {
          return s;
        } else {
          return `<div class="blockquote">${s}</div>`
        } 
      }).join('');
    }

    insertParagraphs(input: string): string {
      return input.split(/\r\n|\r|\n/).map( s => {
        return `<p>${s}</p>`;
      }).join('')
    }

}