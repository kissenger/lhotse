type CloudflareImageOptions = {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
};

function shouldUseLocalImages(stage?: string): boolean {
  if (stage === 'dev') {
    return true;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  }

  return false;
}

function toAssetPath(src: string): string {
  const trimmed = src.trim();
  const withoutLeadingSlash = trimmed.replace(/^\/+/, '');
  return withoutLeadingSlash.startsWith('assets/') ? `/${withoutLeadingSlash}` : `/assets/${withoutLeadingSlash}`;
}

function localAssetUrl(src: string): string {
  const trimmed = src.trim();
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  return toAssetPath(trimmed);
}

function cloudflareAssetUrl(src: string, options: CloudflareImageOptions = {}): string {
  const assetPath = localAssetUrl(src);
  if (/^(https?:)?\/\//i.test(assetPath) || assetPath.startsWith('data:') || assetPath.startsWith('blob:')) {
    return assetPath;
  }

  const params = new URLSearchParams();
  if (options.width) params.set('width', String(options.width));
  if (options.height) params.set('height', String(options.height));
  if (options.quality) params.set('quality', String(options.quality));
  if (options.format) params.set('format', options.format);
  if (options.fit) params.set('fit', options.fit);

  const segment = params.toString().replace(/&/g, ',');
  return segment ? `/cdn-cgi/image/${segment}${assetPath}` : assetPath;
}

export function appImageUrl(src: string, options: CloudflareImageOptions & { stage?: string } = {}): string {
  if (shouldUseLocalImages(options.stage)) {
    return localAssetUrl(src);
  }
  return cloudflareAssetUrl(src, options);
}
