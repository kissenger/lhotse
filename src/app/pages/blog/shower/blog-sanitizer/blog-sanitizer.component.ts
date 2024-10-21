import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-blog-sanitizer',
  imports: [CommonModule],
  standalone: true,
  template: `
    @for (split of splits; track split) {
      <p>
      @for (subsplit of split; track subsplit) {
        @if ($even) {
          {{subsplit}}
        }
        @else {
          @let linkAndText = splitLinkAndText(subsplit);
          <a href="{{linkAndText.link}}">{{linkAndText.text}}</a>
        }
      }
    </p>
    }
  `,
  styles: [],
  
})

export class BlogSanitizerComponent implements OnInit {

  @Input() public content = 'test string';
  /* 
    splits is an array of arrays with the first layer representing paragraphs, and the second layer representing
     external links separated out
  */
  public splits: Array<Array<string>> = [];

  constructor(
  ) { }

  ngOnInit() {
    // split at newlines - \r\n|\r|\n, then for each element split by link string - \%(.*)\%
    this.splits = this.content.split(/\r\n|\r|\n/).map( s => s.split(/\%(.*)\%/));
    console.log(this.content);
  }

  public splitLinkAndText(str: string) {
    const [text, link] = str.split(',');
    return {link, text}
  }

}
