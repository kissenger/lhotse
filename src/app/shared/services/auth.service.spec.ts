import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
    document.cookie = ''; // reset
  });

  it('should set and read token via cookie', () => {
    service.token = { user: 'alice' } as any;
    expect(document.cookie).toContain('__sn_token=');
    const tok = service.token;
    expect(tok).toBeTruthy();
    expect((tok as any).user).toEqual('alice');
  });

  it('should return null for invalid token', () => {
    document.cookie = '__sn_token=not-json';
    expect(service.token).toBeNull();
  });

  it('should delete cookies', () => {
    service.token = { user: 'bob' } as any;
    expect(service.token).toBeTruthy();
    service.deleteCookies();
    expect(service.token).toBeNull();
  });
});
