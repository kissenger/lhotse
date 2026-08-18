import { appImageUrl } from './image-url';

describe('appImageUrl', () => {
  it('preserves same-origin API image URLs', () => {
    expect(appImageUrl('/api/copernicus/current-temperature-plot', {
      stage: 'prod',
      width: 1200,
    })).toBe('/api/copernicus/current-temperature-plot');
  });

  it('continues to resolve normal assets through the asset pipeline', () => {
    expect(appImageUrl('photos/example.jpg', {
      stage: 'prod',
      width: 1200,
    })).toBe('/assets/photos/example.jpg');
  });
});