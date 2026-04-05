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
        - Link string in the form [link:text,link], eg [link:BSAC,https:www.bsac.com]
        - List in the form [list:item1, including commas;item2;item3]
*/

export class HtmlerPipe implements PipeTransform {
    transform(rawString: string): string {
        let outputString = this.insertLinks(rawString);
        outputString = this.insertBlockQuotes(outputString);
        outputString = this.insertUnorderedList(outputString);
        outputString = this.insertTable(outputString);
        outputString = this.insertParagraphs(outputString);
        return outputString;
    }

    insertLinks(input: string): string {
      return input.split(/\[link:([^\][]*)]/).map( (s, i) => {
        if (i % 2 == 0) {
          return s;
        } else {
          const [text, link] = s.split(',');
          const isExternal = /^https?:/.test(link);
          const attrs = isExternal ? ` target="_blank" rel="noopener noreferrer"` : '';
          return `<a href="${link}"${attrs}>${text}</a>`
        } 
      }).join('');
    }

    insertTable(input: string): string {
      return input.split(/\[table:([^\][]*)]/).map((s, i) => {
        if (i % 2 === 0) return s;
        const rows = s.split(';').map(r => r.trim().split('|').map(c => c.trim()));
        const [headerRow, ...bodyRows] = rows;
        const thead = `<thead><tr>${headerRow.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        const tbody = bodyRows.length
          ? `<tbody>${bodyRows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`
          : '';
        return `\n<table>${thead}${tbody}</table>\n`;
      }).join('');
    }

    insertUnorderedList(input: string): string {
      return input.split(/\[list:(.*)\]/).map( (s, i) => {
        if (i % 2 == 0) {
          return s;
        } else {
          return `\n<ul>${s.split(';').map(li=>`<li>${li.trim()}</li>`).join('')}</ul>\n`
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
        if (s === '' || s.startsWith('<ul>') || s.startsWith('<div') || s.startsWith('<table>')) return s;
        return `<p>${s}</p>`;
      }).join('')
    }

}