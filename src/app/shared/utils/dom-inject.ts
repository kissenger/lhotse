export function appendStyleOnce(doc: Document, id: string, cssText: string): void {
  if (doc.getElementById(id)) {
    return;
  }
  const style = doc.createElement('style');
  style.id = id;
  style.textContent = cssText;
  doc.head.appendChild(style);
}

export function appendStylesheetLinkOnce(doc: Document, id: string, href: string): void {
  if (doc.getElementById(id)) {
    return;
  }
  const link = doc.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  link.crossOrigin = 'anonymous';
  link.referrerPolicy = 'strict-origin-when-cross-origin';
  doc.head.appendChild(link);
}
