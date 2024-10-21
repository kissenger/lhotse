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
    
    transform(value: string): SafeHtml {

        let paragraphs = value.split(/\r\n|\r|\n/).map( (s: string) => s.split(/\%(.*)\%/));

        const html = paragraphs.map( para => {
            return `<p>${this.insertLinks(para)}</p>`;
        }).join('');

        console.log(this.sanitized.bypassSecurityTrustHtml(html))
        return this.sanitized.bypassSecurityTrustHtml(html);
    }
    insertLinks(para: Array<string>): string {
        return para.map( (subpara, i) => {
            if (i % 2 == 0) {
                return subpara;
            } 
            else {
                const [text, link] = subpara.split(',');
                return `<a href="${link}">${text}</a>`
            } 
        }).join('');

    }
}