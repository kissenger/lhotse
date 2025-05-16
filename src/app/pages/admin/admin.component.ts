import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@shared/services/auth.service';

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
    private _router: Router
    
  ) {}

  onLogout() {
    this._auth.deleteCookies();
    this._router.navigate(['/admin/login']);
  }
}