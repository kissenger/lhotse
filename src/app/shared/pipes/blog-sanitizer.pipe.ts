import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'

@Pipe({
    name: 'blogSanitizer',
    standalone: true,
    pure: true
})

/*
    Converts a paragraph of text into html for insertion into blog div:
        - Splits by end of line char and wraps each in <p> tags
        - Search for link string in each paragraph, and insert relevant <a> tags
        - Link string in the form %text,link%, eg %BSAC,https:www.bsac.com%
*/

export class BlogSanitizerPipe implements PipeTransform {
    constructor(
        private sanitized: DomSanitizer
    ) {}
    
    transform(rawString: string): SafeHtml {
        // this.outputString = rawString;
        let outputString = this.insertLinks(rawString);
        outputString = this.insertBlockQuotes(outputString);
        outputString = this.insertParagraphs(outputString);

        return this.sanitized.bypassSecurityTrustHtml(outputString);
    }

    insertLinks(input: string): string {
        console.log(input.split(/\%(.*)\%/))
        return input.split(/\[link:([^\][]*)]/).map( (s, i) => {
            console.log(s);
            if (i % 2 == 0) {
                console.log(s);
                return s;
            } 
            else {
                const [text, link] = s.split(',');
                console.log(text, link);
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
        }).join('');
    }

}