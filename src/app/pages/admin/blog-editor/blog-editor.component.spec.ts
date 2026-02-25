import { TestBed } from '@angular/core/testing';
import { BlogEditorComponent } from './blog-editor.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

describe('BlogEditorComponent', () => {
  let comp: BlogEditorComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogEditorComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(BlogEditorComponent);
    comp = f.componentInstance;
  });

  it('creates blog-editor component', () => {
    expect(comp).toBeTruthy();
  });
});
