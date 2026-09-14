'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getApiUrl } from '../lib/api';

import Link from 'next/link';

const GlossaryContext = createContext(null);
const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

function normalizeLookupKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
export function useGlossary() {
  return useContext(GlossaryContext);
}

function GlossaryDetails({ activeTooltip, mobile, onClose }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {activeTooltip.category && (
            <span className="mb-2 inline-block rounded-full bg-brand-accent/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-brand-accent">
              {activeTooltip.category}
            </span>
          )}
          <h4 className="font-display text-base font-bold leading-snug text-ink-primary">
            {activeTooltip.term}
          </h4>
        </div>
        {(mobile || activeTooltip.pinned) && (
          <button
            type="button"
            onClick={onClose}
            className="hit-target -mr-2 -mt-2 inline-flex shrink-0 items-center justify-center rounded-full text-xl text-ink-muted transition hover:bg-surface-muted hover:text-ink-primary"
            aria-label="Close definition"
          >
            ×
          </button>
        )}
      </div>
      <p className="mt-2 text-sm font-normal leading-relaxed text-ink-secondary">
        {activeTooltip.definition}
      </p>
      {activeTooltip.image && (
        <div className="mt-4 overflow-hidden rounded-lg border border-edge-subtle bg-brand-bg">
          <img
            src={activeTooltip.image}
            alt=""
            className="max-h-44 w-full object-contain"
          />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-edge-subtle pt-2">
        <Link
          href="/glossary"
          onClick={onClose}
          className="text-xs font-semibold text-[#101871] hover:underline"
        >
          Learn more in glossary →
        </Link>
        {!mobile && !activeTooltip.pinned && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Click to pin
          </span>
        )}
        {!mobile && activeTooltip.pinned && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-accent">
            Pinned
          </span>
        )}
      </div>
    </>
  );
}

export default function GlossaryProvider({ children }) {
  const [terms, setTerms] = useState([]);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  const termsByNameRef = useRef({});
  const termsByCodeRef = useRef({});
  const activeTooltipRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const isScanningRef = useRef(false);
  const isMobileRef = useRef(false);

  useEffect(() => {
    activeTooltipRef.current = activeTooltip;
  }, [activeTooltip]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateMode = () => {
      isMobileRef.current = mediaQuery.matches;
      setIsMobile(mediaQuery.matches);
    };
    updateMode();
    mediaQuery.addEventListener('change', updateMode);
    return () => mediaQuery.removeEventListener('change', updateMode);
  }, []);

  useEffect(() => {
    fetch(getApiUrl('/api/glossary/'))
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load glossary');
        return response.json();
      })
      .then((data) => {
        const loadedTerms = Array.isArray(data) ? data : [];
        const byName = {};
        const byCode = {};

        loadedTerms.forEach((term) => {
          byName[term.term.toLowerCase()] = term;
          byCode[normalizeLookupKey(term.term)] = term;
          if (term.internal_code) byCode[term.internal_code.toLowerCase()] = term;
        });

        termsByNameRef.current = byName;
        termsByCodeRef.current = byCode;
        setTerms(loadedTerms);
      })
      .catch(() => {
        // Definitions enhance the reading experience but should never block a page.
      });
  }, []);

  const getTermByCode = useCallback((code) => {
    return termsByCodeRef.current[String(code || '').toLowerCase()] || null;
  }, []);

  const scanTextNodes = useCallback((node, regex) => {
    if (!node) return;
    const skipTags = ['A', 'BUTTON', 'CODE', 'IFRAME', 'INPUT', 'NOSCRIPT', 'PRE', 'SCRIPT', 'STYLE', 'SVG', 'TEXTAREA'];

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (
        skipTags.includes(node.tagName) ||
        node.classList.contains('glossary-highlight') ||
        node.hasAttribute('data-glossary-disabled')
      ) return;

      Array.from(node.childNodes).forEach((child) => scanTextNodes(child, regex));
      return;
    }

    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return;
    const text = node.textContent;
    regex.lastIndex = 0;
    if (!regex.test(text)) return;
    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const term = termsByNameRef.current[match[0].toLowerCase()];
      if (term) {
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'glossary-highlight';
        trigger.textContent = match[0];
        trigger.setAttribute('data-term', term.term);
        trigger.setAttribute('data-definition', term.definition);
        trigger.setAttribute('data-category', term.category || '');
        trigger.setAttribute('data-image', term.image_url || '');
        trigger.setAttribute('aria-label', `${match[0]}. Open definition for ${term.term}`);
        trigger.setAttribute('aria-haspopup', 'dialog');
        fragment.appendChild(trigger);
      } else {
        fragment.appendChild(document.createTextNode(match[0]));
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode?.replaceChild(fragment, node);
  }, []);

  const scanDocument = useCallback(() => {
    if (!terms.length || isScanningRef.current) return;
    const containers = document.querySelectorAll('[data-glossary-scan]');
    if (!containers.length) return;

    const activeTerms = terms.filter((term) => term.is_tooltip_enabled !== false);
    const escapedTerms = activeTerms
      .map((term) => term.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((left, right) => right.length - left.length);
    if (!escapedTerms.length) return;

    isScanningRef.current = true;
    const regex = new RegExp(`(?<![a-zA-Z0-9_])(${escapedTerms.join('|')})(?![a-zA-Z0-9_])`, 'gi');
    containers.forEach((container) => scanTextNodes(container, regex));
    isScanningRef.current = false;
  }, [scanTextNodes, terms]);

  useEffect(() => {
    if (!terms.length) return undefined;
    const timer = window.setTimeout(scanDocument, 150);
    const root = document.getElementById('main-content') || document.body;
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length > 0)) {
        window.setTimeout(scanDocument, 0);
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname, scanDocument, terms.length]);

  const closeTooltip = useCallback(() => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    activeTooltipRef.current = null;
    setActiveTooltip(null);
  }, []);

  const openTooltip = useCallback((trigger, pinned = false) => {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const nextTooltip = {
      term: trigger.getAttribute('data-term'),
      definition: trigger.getAttribute('data-definition'),
      category: trigger.getAttribute('data-category'),
      image: trigger.getAttribute('data-image'),
      pinned: isMobileRef.current || pinned,
      trigger,
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
    };
    activeTooltipRef.current = nextTooltip;
    setActiveTooltip(nextTooltip);
  }, []);

  useEffect(() => {
    const handleMouseOver = (event) => {
      if (isMobileRef.current || activeTooltipRef.current?.pinned) return;
      const trigger = event.target.closest?.('.glossary-highlight');
      if (!trigger) return;
      if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
      openTooltip(trigger, false);
    };

    const handleMouseOut = (event) => {
      if (isMobileRef.current || activeTooltipRef.current?.pinned) return;
      const trigger = event.target.closest?.('.glossary-highlight');
      if (!trigger) return;
      const destination = event.relatedTarget;
      if (destination?.closest?.('.glossary-tooltip') || trigger.contains(destination)) return;
      hoverTimeoutRef.current = window.setTimeout(closeTooltip, 180);
    };

    const handleFocusIn = (event) => {
      if (isMobileRef.current || activeTooltipRef.current?.pinned) return;
      const trigger = event.target.closest?.('.glossary-highlight');
      if (trigger) openTooltip(trigger, false);
    };

    const handleFocusOut = (event) => {
      if (isMobileRef.current || activeTooltipRef.current?.pinned) return;
      if (event.target.closest?.('.glossary-highlight') && !event.relatedTarget?.closest?.('.glossary-tooltip')) {
        hoverTimeoutRef.current = window.setTimeout(closeTooltip, 120);
      }
    };

    const handleClick = (event) => {
      const trigger = event.target.closest?.('.glossary-highlight');
      if (trigger) {
        event.preventDefault();
        const current = activeTooltipRef.current;
        if (current?.pinned && current.trigger === trigger && !isMobileRef.current) {
          closeTooltip();
        } else {
          openTooltip(trigger, true);
        }
        return;
      }
      if (!event.target.closest?.('.glossary-tooltip')) closeTooltip();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeTooltip();
    };

    const updatePinnedPosition = () => {
      const current = activeTooltipRef.current;
      if (!current?.pinned || isMobileRef.current || !current.trigger?.isConnected) return;
      const rect = current.trigger.getBoundingClientRect();
      const updated = { ...current, rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width } };
      activeTooltipRef.current = updated;
      setActiveTooltip(updated);
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', updatePinnedPosition, { passive: true });
    window.addEventListener('resize', updatePinnedPosition);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', updatePinnedPosition);
      window.removeEventListener('resize', updatePinnedPosition);
    };
  }, [closeTooltip, openTooltip]);

  const getDesktopPosition = () => {
    if (!activeTooltip?.rect || typeof window === 'undefined') return {};
    const width = activeTooltip.pinned ? 384 : 304;
    const halfWidth = width / 2;
    const left = Math.min(
      Math.max(activeTooltip.rect.left + activeTooltip.rect.width / 2, halfWidth + 16),
      window.innerWidth - halfWidth - 16,
    );
    const placeAbove = activeTooltip.rect.top > (activeTooltip.pinned ? 300 : 230);
    return {
      left: `${left}px`,
      top: `${placeAbove ? activeTooltip.rect.top - 10 : activeTooltip.rect.bottom + 10}px`,
      transform: placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
    };
  };

  const contextValue = useMemo(
    () => ({ terms, getTermByCode, refetch: scanDocument }),
    [getTermByCode, scanDocument, terms],
  );

  return (
    <GlossaryContext.Provider value={contextValue}>
      {children}

      {activeTooltip && !isMobile && (
        <div
          id="glossary-global-tooltip"
          className={`glossary-tooltip glossary-popover fixed z-[9999] rounded-xl border border-edge bg-white p-4 shadow-elevated ${activeTooltip.pinned ? 'w-96' : 'w-[19rem]'}`}
          style={getDesktopPosition()}
          role={activeTooltip.pinned ? 'dialog' : 'tooltip'}
          aria-modal={activeTooltip.pinned ? 'false' : undefined}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
          }}
          onMouseLeave={() => {
            if (!activeTooltipRef.current?.pinned) {
              hoverTimeoutRef.current = window.setTimeout(closeTooltip, 160);
            }
          }}
        >
          <GlossaryDetails activeTooltip={activeTooltip} mobile={false} onClose={closeTooltip} />
        </div>
      )}

      {activeTooltip && isMobile && (
        <div className="glossary-sheet-backdrop fixed inset-0 z-[9998] flex items-end bg-slate-950/35" onClick={closeTooltip}>
          <div
            className="glossary-tooltip glossary-bottom-sheet w-full rounded-t-2xl border-t border-edge bg-white px-5 pb-6 pt-3 shadow-elevated"
            role="dialog"
            aria-modal="true"
            aria-label={`Definition: ${activeTooltip.term}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-edge-strong" aria-hidden="true" />
            <GlossaryDetails activeTooltip={activeTooltip} mobile onClose={closeTooltip} />
          </div>
        </div>
      )}
    </GlossaryContext.Provider>
  );
}
