import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'htmler',
    standalone: true,
    pure: true
})

/*
    Converts a paragraph of text into html for insertion into blog div:
        - Splits by end of line char and wraps each in <p> tags
        - Search for link string in each paragraph, and insert relevant <a> tags
        - Link string in the form %text,link%, eg %BSAC,https:www.bsac.com%
*/

export class HtmlerPipe implements PipeTransform {
    constructor() {}
    
    transform(rawString: string): string {
        // this.outputString = rawString;
        let outputString = this.insertLinks(rawString);
        outputString = this.insertBlockQuotes(outputString);
        outputString = this.insertParagraphs(outputString);

        return outputString;
    }

    insertLinks(input: string): string {
        return input.split(/\[link:([^\][]*)]/).map( (s, i) => {
            if (i % 2 == 0) {
                return s;
            } 
            else {
                const [text, link] = s.split(',');
                return `<a href="${link}">${text}</a>`
            } 
        }).join('');
    }

    insertBlockQuotes(input: string): string {
        return input.split(/\[blockquote:(.*)\]/).map( (s, i) => {
            if (i % 2 == 0) {
                return s;
            } 
            else {
                const [text, link] = s.split(',');
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