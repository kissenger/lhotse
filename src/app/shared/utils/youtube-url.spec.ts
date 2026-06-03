import { buildYouTubeEmbedUrl, extractYouTubeVideoId } from './youtube-url';

describe('youtube-url utils', () => {
  describe('extractYouTubeVideoId', () => {
    it('returns direct video id input', () => {
      expect(extractYouTubeVideoId('nglkG5wdsmY')).toBe('nglkG5wdsmY');
    });

    it('extracts id from youtube watch url', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=nglkG5wdsmY')).toBe('nglkG5wdsmY');
    });

    it('extracts id from youtu.be url', () => {
      expect(extractYouTubeVideoId('https://youtu.be/nglkG5wdsmY')).toBe('nglkG5wdsmY');
    });

    it('extracts id from shorts url', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/shorts/nglkG5wdsmY')).toBe('nglkG5wdsmY');
    });

    it('extracts id from embed url', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/embed/nglkG5wdsmY')).toBe('nglkG5wdsmY');
    });

    it('returns empty string for non-youtube host', () => {
      expect(extractYouTubeVideoId('https://example.com/watch?v=nglkG5wdsmY')).toBe('');
    });

    it('returns empty string for invalid or missing id', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=bad')).toBe('');
      expect(extractYouTubeVideoId('https://www.youtube.com/watch')).toBe('');
    });

    it('returns empty string for malformed input', () => {
      expect(extractYouTubeVideoId('not a url')).toBe('');
      expect(extractYouTubeVideoId('')).toBe('');
    });
  });

  describe('buildYouTubeEmbedUrl', () => {
    it('builds canonical embed url with autoplay-safe params', () => {
      expect(buildYouTubeEmbedUrl('https://www.youtube.com/watch?v=nglkG5wdsmY')).toBe(
        'https://www.youtube-nocookie.com/embed/nglkG5wdsmY?controls=0&mute=1&autoplay=1&playsinline=1&rel=0&loop=1&playlist=nglkG5wdsmY'
      );
    });

    it('returns empty string when id cannot be resolved', () => {
      expect(buildYouTubeEmbedUrl('https://example.com/video/123')).toBe('');
    });
  });
});
