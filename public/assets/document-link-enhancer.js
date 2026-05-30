(function () {
  const VIEWER_PATH = '/viewer/index.html';
  const DOC_HOST_PATTERN = /^https:\/\/www\.genspark\.ai\/(api\/files\/s\/|doc_agent\?id=)/i;
  const DOC_EXT_PATTERN = /\.(pdf|doc|docx|ppt|pptx|txt|rtf|odt)(\?|#|$)/i;

  function isSharableDocumentLink(href) {
    if (!href) return false;
    const value = href.trim();
    if (!value || value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('javascript:')) {
      return false;
    }
    return DOC_HOST_PATTERN.test(value) || DOC_EXT_PATTERN.test(value);
  }

  function buildViewerUrl(href, label) {
    const params = new URLSearchParams();
    params.set('url', href);
    if (label) params.set('title', label);
    return `${VIEWER_PATH}?${params.toString()}`;
  }

  function enhanceLink(anchor) {
    if (!anchor || anchor.dataset.documentLinkEnhanced === 'true') return;
    const originalHref = anchor.getAttribute('href');
    if (!isSharableDocumentLink(originalHref)) return;

    const label = (anchor.textContent || '').trim() || 'Document';
    const viewHref = buildViewerUrl(originalHref, label);

    anchor.dataset.documentLinkEnhanced = 'true';
    anchor.dataset.originalHref = originalHref;
    anchor.href = viewHref;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.classList.add('document-view-link');
  }

  function injectStyles() {
    if (document.getElementById('document-link-enhancer-styles')) return;
    const style = document.createElement('style');
    style.id = 'document-link-enhancer-styles';
    style.textContent = `
      .document-view-link { cursor: pointer; }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    document.querySelectorAll('a[href]').forEach(enhanceLink);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
