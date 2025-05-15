import { Component} from '@angular/core';
import { AuthService } from '../../../shared/services/auth.service';
import { HttpService } from '@shared/services/http.service';
import { FormsModule } from "@angular/forms";
import { AuthUser } from '@shared/types';

@Component({
  standalone: true,
  imports: [FormsModule],
  providers: [],
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})

export class LoginComponent {

  public user: AuthUser = {
    userName: '',
    password: ''
  }

  constructor(
    private auth: AuthService,
    private _http: HttpService
  ) {}

  async onSubmit() {
    let res = await this._http.login(this.user);
    
  }

  onCancel() {

  }
}