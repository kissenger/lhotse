import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { NavService } from '@shared/services/nav.service';
import { CommonModule } from '@angular/common';
import { ExternalLinkComponent } from '@shared/components/external-link/external-link.component';

@Component({
  selector: 'app-blog-sanitizer',
  imports: [CommonModule, ExternalLinkComponent],
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
          <app-external-link text={{linkAndText.text}} link="{{linkAndText.link}}"></app-external-link>
        }
      }
    </p>
    }
  `,
  styles: [],
  encapsulation: ViewEncapsulation.None
})

export class BlogSanitizerComponent implements OnInit {

  @Input() public content = 'test string';
  /* 
    splits is an array of arrays with the first layer representing paragraphs, and the second layer representing
     external links separated out
  */
  public splits: Array<Array<string>> = [];

  constructor(
    public navigate: NavService
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