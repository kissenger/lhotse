import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
    document.cookie = '__sn_session=; max-age=0'; // reset
  });

  it('should report not logged in when session cookie absent', () => {
    expect(service.isLoggedIn).toBeFalse();
  });

  it('should report logged in when session cookie present', () => {
    document.cookie = '__sn_session=1';
    expect(service.isLoggedIn).toBeTrue();
  });

  it('should delete session cookie on deleteCookies()', () => {
    document.cookie = '__sn_session=1';
    expect(service.isLoggedIn).toBeTrue();
    service.deleteCookies();
    expect(service.isLoggedIn).toBeFalse();
  });
});
