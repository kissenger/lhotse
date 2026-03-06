import { Directive, Input } from '@angular/core';

export type SvgTheme = 'lightOnDark' | 'darkOnLight';

@Directive()
export abstract class ThemedSvgBase {
  @Input() public theme?: SvgTheme;
  @Input() public height?: string;

  protected setDefaultHeight(value: string) {
    this.height = this.height ?? value;
  }

  protected get primaryColour() {
    return this.theme === 'lightOnDark' ? '#FFFFFF' : '#1D3D59';
  }

  protected get inverseColour() {
    return this.theme === 'lightOnDark' ? '#1D3D59' : '#FFFFFF';
  }
}
