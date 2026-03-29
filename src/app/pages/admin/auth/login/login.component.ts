import { Component} from '@angular/core';
import { AuthService } from '../../../../shared/services/auth.service';
import { HttpService } from '../../../../shared/services/http.service';
import { FormsModule } from "@angular/forms";
import { AuthUser } from '../../../../shared/types';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@shared/services/toast.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  providers: [],
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['../auth.css']
})

export class LoginComponent {

  public user: AuthUser = {
    username: '',
    password: ''
  }

  constructor(
    private _auth: AuthService,
    private _http: HttpService,
    private _router: Router,
    private _route: ActivatedRoute,
    private _toaster: ToastService
  ) {}

  async onSubmit() {
    document.body.style.cursor = 'wait';
    try {
      await this._http.login(this.user);
      const rawRedirect = this._route.snapshot.queryParamMap.get('redirect');
      // Only allow relative same-origin redirects (must start with '/' but not '//')
      const redirect = (rawRedirect?.startsWith('/') && !rawRedirect.startsWith('//')) ? rawRedirect : '/dashboard';
      this._router.navigateByUrl(redirect);
    } catch (error: any) {
      console.error(error);
      this._toaster.show(<string>error?.error?.message || 'Login failed', 'error');
    } finally {
      document.body.style.cursor = 'auto';
    }
  }

  onCancel() {

  }

  isValidForm() {
    return !!this.user.username && !!this.user.password 
  }
}