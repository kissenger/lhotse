import { TestBed } from '@angular/core/testing';
import { ExportFileService } from './export.service';

describe('ExportFileService', () => {
  let svc: ExportFileService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ExportFileService] });
    svc = TestBed.inject(ExportFileService);
  });

  it('royalMailServiceCodes maps descriptions', () => {
    expect(svc.royalMailServiceCodes('Royal Mail First Class')).toContain('TOLP');
    expect(svc.royalMailServiceCodes('Royal Mail Tracked 48')).toBe('TOLP48');
    expect(svc.royalMailServiceCodes('Unknown')).toBe('');
  });

  it('createCSV should build and trigger download (no throw)', () => {
    spyOn(document, 'createElement').and.callThrough();
    spyOn(document.body, 'appendChild').and.callFake((n: any) => n as any);
    spyOn(document.body, 'removeChild').and.callFake((n: any) => n as any);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:1');
    const order: any = {
      orderNumber: 'O1',
      items: [{ quantity: 1, unit_amount: { value: 2 } }],
      shippingOption: 'Royal Mail Tracked 48',
      user: { name: 'A B', email_address: 'a@b', organisation: '', address: { address_line_1: 'L1', address_line_2: '', admin_area_2: '', admin_area_1: '', postal_code: 'P' } }
    };
    expect(() => svc.createCSV([order])).not.toThrow();
  });
});
