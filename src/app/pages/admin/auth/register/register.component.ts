import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../shared/services/auth.service';
import { FormsModule } from "@angular/forms";
import { AuthUser } from '../../../../shared/types';
import { HttpService } from '../../../../shared/services/http.service';
import { ToastService } from '@shared/services/toast.service';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  imports: [FormsModule, CommonModule],
  providers: [],
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['../auth.css']
})

export class RegisterComponent {

  public user: AuthUser = {
    username: '',
    password: '',
    email: '',
    role: 'user'
  }
  public confirmPassword: string = '';

  constructor(
    private _auth: AuthService,
    private _http: HttpService,
    private _toaster: ToastService,
    private _router: Router
    
  ) {}

  async onSubmit() {
    try {
      document.body.style.cursor = 'wait';
      let res = await this._http.register(this.user);
      document.body.style.cursor = 'auto';
      this._auth.token = res.token;
      this._router.navigate(['/admin']); 
    } catch (error) {
      // this._toaster.show(<string>error.message, 'error');
    }
  }

  onCancel() {
    this._router.navigate(['/admin/login']); 
  }

  isValidEmail() {
    return !!this.user.email!.match(/[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}/);
  }
  isValidUserName() {
    // regex matches whitespace at front or end to avoid username typo - disallow all spaces, aids search by username
    return this.user.username.length > 4 && !this.user.username.match(/\s/);
  }
  isValidPwd() {
    return this.user.password!.length > 8;
  }
  isValidConfPwd() {
    return this.confirmPassword !== '' && this.user.password === this.confirmPassword;
  }
  isValidForm() {
    return this.isValidEmail() && this.isValidUserName() && this.isValidPwd() && this.isValidConfPwd();
  }

}