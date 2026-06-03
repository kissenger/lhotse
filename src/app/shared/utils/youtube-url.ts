export function extractYouTubeVideoId(value: string): string {
  const input = (value || '').trim();
  if (!input) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] || '';
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v') || '';
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
      }

      if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
        const id = url.pathname.split('/').filter(Boolean)[1] || '';
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
      }
    }
  } catch {
    return '';
  }

  return '';
}

export function buildYouTubeEmbedUrl(value: string): string {
  const id = extractYouTubeVideoId(value);
  if (!id) return '';

  return `https://www.youtube-nocookie.com/embed/${id}?controls=0&mute=1&autoplay=1&playsinline=1&rel=0&loop=1&playlist=${id}`;
}