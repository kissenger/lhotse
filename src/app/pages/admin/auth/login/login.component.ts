import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { HttpService } from '../../../../shared/services/http.service';
import { FormsModule } from "@angular/forms";
import { AuthUser } from '../../../../shared/types';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@shared/services/toast.service';
import { errorMessage } from '@shared/utils/error-message';

@Component({
  standalone: true,
  imports: [FormsModule],
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['../auth.css']
})

export class LoginComponent implements AfterViewInit {

  @ViewChild('usernameInput') usernameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') passwordInput?: ElementRef<HTMLInputElement>;

  public user: AuthUser = {
    username: '',
    password: ''
  }

  constructor(
    private _http: HttpService,
    private _router: Router,
    private _route: ActivatedRoute,
    private _toaster: ToastService
  ) {}

  ngAfterViewInit() {
    this._syncFormState();
    this._watchForAutofill();
  }

  async onSubmit() {
    document.body.style.cursor = 'wait';
    try {
      await this._http.login(this.user);
      const rawRedirect = this._route.snapshot.queryParamMap.get('redirect');
      // Only allow relative same-origin redirects (must start with '/' but not '//')
      const redirect = (rawRedirect?.startsWith('/') && !rawRedirect.startsWith('//')) ? rawRedirect : '/dashboard';
      this._router.navigateByUrl(redirect);
    } catch (error: any) {
      this._toaster.show(errorMessage(error, 'Login failed'), 'error');
    } finally {
      document.body.style.cursor = 'auto';
    }
  }

  onCancel() {

  }

  onFieldInput() {
    this._syncFormState();
  }

  isValidForm() {
    return !!this.user.username && !!this.user.password;
  }

  private _syncFormState() {
    this.user.username = this.user.username?.trim() ?? '';
    this.user.password = this.user.password?.trim() ?? '';
  }

  private _watchForAutofill() {
    const sync = () => this._syncFormState();
    const inputs = [this.usernameInput?.nativeElement, this.passwordInput?.nativeElement].filter(Boolean) as HTMLInputElement[];

    inputs.forEach((input) => {
      input.addEventListener('input', sync, { passive: true });
      input.addEventListener('change', sync, { passive: true });
      input.addEventListener('keyup', sync, { passive: true });
    });

    setTimeout(sync, 0);
    setTimeout(sync, 100);
    setTimeout(sync, 300);
  }
}