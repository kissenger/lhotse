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
  - Bold in the form **bold** (also tolerates **bold*)
*/

export class HtmlerPipe implements PipeTransform {
    private readonly entitySemiToken = '__HTML_ENTITY_SEMI__';

    private protectEntitySemicolons(content: string): string {
      return content.replace(/&(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);/g, entity =>
        entity.replace(';', this.entitySemiToken)
      );
    }

    private restoreEntitySemicolons(content: string): string {
      return content.replaceAll(this.entitySemiToken, ';');
    }

    transform(rawString: string): string {
        let outputString = this.insertBold(rawString);
        outputString = this.insertLinks(outputString);
        outputString = this.insertBlockQuotes(outputString);
        outputString = this.insertUnorderedList(outputString);
        outputString = this.insertTable(outputString);
        outputString = this.insertParagraphs(outputString);
        return outputString;
    }

    insertBold(input: string): string {
      return input
        .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*\*([^*\n]+?)\*(?!\*)/g, '<strong>$1</strong>');
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
        // Preserve entity semicolons (e.g. &mdash;, &#8212;) so row splitting stays stable.
        const protectedContent = this.protectEntitySemicolons(s);
        const rows = protectedContent
          .split(';')
          .map(r => r.trim().split('|').map(c => this.restoreEntitySemicolons(c.trim())));
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
          // Preserve entity semicolons (e.g. &mdash;, &#8212;) so item splitting stays stable.
          const protectedContent = this.protectEntitySemicolons(s);
          return `\n<ul>${protectedContent
            .split(';')
            .map(li => `<li>${this.restoreEntitySemicolons(li.trim())}</li>`)
            .join('')}</ul>\n`
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