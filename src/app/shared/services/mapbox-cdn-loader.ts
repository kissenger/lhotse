import type * as mapboxgl from 'mapbox-gl';
import { MAPBOX_JS_URL } from '@shared/globals';

type MapboxRuntime = {
  Map: typeof mapboxgl.Map;
  Marker: typeof mapboxgl.Marker;
  NavigationControl: typeof mapboxgl.NavigationControl;
  accessToken: string;
};

const MAPBOX_SCRIPT_ID = 'mapbox-gl-js';
const MAPBOX_SCRIPT_TIMEOUT_MS = 15000;
let mapboxLoadPromise: Promise<MapboxRuntime> | null = null;

export function loadMapboxFromCdn(doc: Document = document): Promise<MapboxRuntime> {
  const win = doc.defaultView;
  if (!win) {
    return Promise.reject(new Error('No window available for Mapbox script loading'));
  }

  const getRuntime = (): MapboxRuntime | undefined => (win as any).mapboxgl as MapboxRuntime | undefined;

  if (getRuntime()?.Map && getRuntime()?.Marker) {
    return Promise.resolve(getRuntime()!);
  }

  if (mapboxLoadPromise) {
    return mapboxLoadPromise;
  }

  mapboxLoadPromise = new Promise<MapboxRuntime>((resolve, reject) => {
    const complete = () => {
      const mb = getRuntime();
      if (mb?.Map && mb?.Marker) {
        resolve(mb);
        return;
      }
      reject(new Error('Mapbox script loaded but global object is missing'));
    };

    const existing = doc.getElementById(MAPBOX_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        complete();
        return;
      }
      existing.addEventListener('load', complete, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Mapbox script')), { once: true });
      return;
    }

    const script = doc.createElement('script');
    script.id = MAPBOX_SCRIPT_ID;
    script.src = MAPBOX_JS_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'strict-origin-when-cross-origin';

    const timer = win.setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading Mapbox script after ${MAPBOX_SCRIPT_TIMEOUT_MS}ms`));
    }, MAPBOX_SCRIPT_TIMEOUT_MS);

    script.addEventListener('load', () => {
      win.clearTimeout(timer);
      script.setAttribute('data-loaded', 'true');
      complete();
    }, { once: true });

    script.addEventListener('error', () => {
      win.clearTimeout(timer);
      script.remove();
      reject(new Error('Failed to load Mapbox script from CDN'));
    }, { once: true });

    doc.head.appendChild(script);
  }).catch((error) => {
    mapboxLoadPromise = null;
    throw error;
  });

  return mapboxLoadPromise;
}
