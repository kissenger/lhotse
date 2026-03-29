import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@shared/services/auth.service';
import { HttpService } from '@shared/services/http.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})

export class AdminComponent  {
  constructor(
    private _auth: AuthService,
    private _http: HttpService,
    private _router: Router,    
  ) {}

  async onLogout() {
    try { await this._http.logout(); } catch {}
    this._auth.deleteCookies();
    this._router.navigate(['/login']);
  }

}