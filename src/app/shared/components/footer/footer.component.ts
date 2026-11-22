import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { YoutubeSvgComponent } from '@shared/svg/youtube/youtube.component';
import { FacebookSvgComponent } from '@shared/svg/facebook/facebook.component';
import { InstagramSvgComponent } from '@shared/svg/instagram/instagram.component';
import { EmailSvgComponent } from '@shared/svg/email/email.component';

@Component({
  standalone: true,
  imports: [RouterLink, YoutubeSvgComponent, FacebookSvgComponent, InstagramSvgComponent, EmailSvgComponent],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./footer.component.css']
})
export class FooterComponent{
  public fullYear = new Date().getFullYear();
}
