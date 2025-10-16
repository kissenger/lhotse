import { Component} from '@angular/core';
import { AuthService } from '../../../../shared/services/auth.service';
import { HttpService } from '../../../../shared/services/http.service';
import { FormsModule } from "@angular/forms";
import { AuthUser } from '../../../../shared/types';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '@shared/services/toast.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
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
    private _toaster: ToastService
  ) {}

  async onSubmit() {

    try {
      document.body.style.cursor = 'wait';
      let res = await this._http.login(this.user);
      document.body.style.cursor = 'auto';
      this._auth.token = res.token;
      this._router.navigate(['/admin']); 
    } catch (error: any) {
      document.body.style.cursor = 'auto';
      console.log(error);
      this._toaster.show(<string>error.error.message, 'error');
    }
  }

  onCancel() {

  }

  isValidForm() {
    return !!this.user.username && !!this.user.password 
  }
}