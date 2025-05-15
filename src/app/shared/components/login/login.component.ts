import { Component} from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  imports: [],
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})

export class LoginComponent {

  public password = '';
  public passwordConfirm = '';
  public email = '';
  public userName = '';

  constructor(
    private auth: AuthService,
  ) {

  }
}