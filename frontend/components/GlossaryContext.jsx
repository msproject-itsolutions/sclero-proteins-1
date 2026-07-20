"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getApiUrl } from '../lib/api';

const GlossaryContext = createContext(null);

export function useGlossary() {
  return useContext(GlossaryContext);
}

export default function GlossaryProvider({ children }) {
  const [terms, setTerms] = useState([]);
  const [activeTooltip, setActiveTooltip] = useState(null); // { term, definition, category, image, rect }
  const pathname = usePathname();
  
  const observerRef = useRef(null);
  const termsMapRef = useRef({});
  const hoverTimeoutRef = useRef(null);
  const isScanningRef = useRef(false);

  // Fetch glossary terms from the backend public endpoint
  useEffect(() => {
    fetch(getApiUrl('/api/glossary/'))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load glossary");
        return res.json();
      })
      .then((data) => {
        setTerms(data || []);
        
        // Build term map for fast lookup
        const map = {};
        (data || []).forEach((t) => {
          map[t.term.toLowerCase()] = t;
        });
        termsMapRef.current = map;
      })
      .catch(() => {
        // Glossary is non-critical — fail silently if the API is unreachable
      });
  }, []);

  // Scanning function to traverse text nodes
  const scanTextNodes = (node, regex, termsMap) => {
    if (!node) return;
    const skipTags = ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'PRE', 'CODE', 'BUTTON', 'A', 'SVG', 'NOSCRIPT', 'IFRAME'];
    
    if (node.nodeType === 1) { // ELEMENT_NODE
      if (skipTags.includes(node.tagName) || node.classList.contains('glossary-highlight')) {
        return;
      }
      
      // Copy childNodes array because we modify the DOM dynamically
      const children = Array.from(node.childNodes);
      for (const child of children) {
        scanTextNodes(child, regex, termsMap);
      }
    } else if (node.nodeType === 3) { // TEXT_NODE
      const text = node.textContent;
      if (!text.trim()) return;

      regex.lastIndex = 0;
      if (!regex.test(text)) return;
      regex.lastIndex = 0;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const matchText = match[0];
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, matchIndex)));
        }

        const lowerMatch = matchText.toLowerCase();
        const termData = termsMap[lowerMatch];

        if (termData) {
          const span = document.createElement('span');
          span.className = 'glossary-highlight';
          span.textContent = matchText;
          span.setAttribute('data-term', termData.term);
          span.setAttribute('data-definition', termData.definition);
          span.setAttribute('data-category', termData.category || '');
          span.setAttribute('data-image', termData.image_url || '');
          fragment.appendChild(span);
        } else {
          fragment.appendChild(document.createTextNode(matchText));
        }

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      node.parentNode.replaceChild(fragment, node);
    }
  };

  const scanDocument = () => {
    if (terms.length === 0 || isScanningRef.current) return;
    
    const container = document.querySelector('main') || document.getElementById('main-content') || document.body;
    if (!container) return;

    isScanningRef.current = true;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Escape terms and build RegExp
    const escapedTerms = terms.map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // Sort descending by length so longer terms are matched first
    escapedTerms.sort((a, b) => b.length - a.length);

    // Use lookbehind and lookahead to support terms with non-alphanumeric boundaries (like parenthesis, slash, spaces)
    const regex = new RegExp('(?<![a-zA-Z0-9_])(' + escapedTerms.join('|') + ')(?![a-zA-Z0-9_])', 'gi');

    scanTextNodes(container, regex, termsMapRef.current);

    if (observerRef.current) {
      observerRef.current.observe(container, {
        childList: true,
        subtree: true,
      });
    }

    isScanningRef.current = false;
  };

  // Re-run scanner on mount, when terms change, or route transitions
  useEffect(() => {
    if (terms.length === 0) return;

    // Initial scan after rendering settles
    const timer = setTimeout(scanDocument, 300);

    // Setup mutation observer to watch for dynamic DOM updates (like category listings, ajax loads)
    const container = document.querySelector('main') || document.getElementById('main-content') || document.body;
    if (container) {
      const observer = new MutationObserver((mutations) => {
        // Only trigger scan if new nodes are added
        let hasNewNodes = false;
        for (const mutation of mutations) {
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            // Ensure we aren't observing our own tooltip additions
            const isTooltipMutation = Array.from(mutation.addedNodes).some(
              (n) => n.id === 'glossary-global-tooltip' || (n.classList && n.classList.contains('glossary-tooltip'))
            );
            if (!isTooltipMutation) {
              hasNewNodes = true;
              break;
            }
          }
        }
        if (hasNewNodes) {
          scanDocument();
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true
      });
      observerRef.current = observer;
    }

    return () => {
      clearTimeout(timer);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [terms, pathname]);

  // Handle global mouse hover and tap events (event delegation)
  useEffect(() => {
    const handleMouseOver = (e) => {
      const highlight = e.target.closest('.glossary-highlight');
      if (!highlight) return;

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      const rect = highlight.getBoundingClientRect();
      setActiveTooltip({
        term: highlight.getAttribute('data-term'),
        definition: highlight.getAttribute('data-definition'),
        category: highlight.getAttribute('data-category'),
        image: highlight.getAttribute('data-image'),
        rect: {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        },
      });
    };

    const handleMouseOut = (e) => {
      const highlight = e.target.closest('.glossary-highlight');
      const tooltip = e.relatedTarget?.closest('.glossary-tooltip');
      
      // If we move away from both the highlight and the tooltip itself, hide it
      if (highlight || tooltip) return;

      hoverTimeoutRef.current = setTimeout(() => {
        setActiveTooltip(null);
      }, 250);
    };

    // For touch devices (tap to show, tap outside to hide)
    const handleTouchStart = (e) => {
      const highlight = e.target.closest('.glossary-highlight');
      const tooltip = e.target.closest('.glossary-tooltip');

      if (highlight) {
        e.preventDefault();
        const rect = highlight.getBoundingClientRect();
        setActiveTooltip({
          term: highlight.getAttribute('data-term'),
          definition: highlight.getAttribute('data-definition'),
          category: highlight.getAttribute('data-category'),
          image: highlight.getAttribute('data-image'),
          rect: {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
          },
        });
      } else if (!tooltip) {
        // Tapped outside
        setActiveTooltip(null);
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  // Render Tooltip Position styles dynamically
  const getTooltipStyle = () => {
    if (!activeTooltip?.rect) return {};
    const { top, left, width, height } = activeTooltip.rect;
    
    // Position it centered above the highlight element
    return {
      top: `${top - 8}px`,
      left: `${left + width / 2}px`,
      transform: 'translate(-50%, -100%)',
    };
  };

  return (
    <GlossaryContext.Provider value={{ terms, refetch: scanDocument }}>
      {children}
      
      {/* Dynamic Global Tooltip Card */}
      {activeTooltip && (
        <div
          id="glossary-global-tooltip"
          className="glossary-tooltip absolute z-[9999] w-72 bg-slate-950/95 text-white border border-slate-800 shadow-2xl rounded-lg p-4 font-inter text-xs pointer-events-auto backdrop-blur-md transition-all duration-300"
          style={getTooltipStyle()}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          }}
          onMouseLeave={() => {
            hoverTimeoutRef.current = setTimeout(() => {
              setActiveTooltip(null);
            }, 200);
          }}
        >
          {activeTooltip.category && (
            <span className="inline-block bg-brand-success/15 text-brand-success text-[10px] uppercase font-bold tracking-wide rounded-sm px-1.5 py-0.5 mb-1.5">
              {activeTooltip.category}
            </span>
          )}
          <h4 className="font-bold text-sm text-slate-100 mb-1">{activeTooltip.term}</h4>
          <p className="text-slate-300 leading-relaxed font-normal">{activeTooltip.definition}</p>
          
          {activeTooltip.image && (
            <div className="mt-3.5 border-t border-slate-800/80 pt-3">
              <img
                src={activeTooltip.image}
                alt={activeTooltip.term}
                className="w-full max-h-32 object-contain rounded-md bg-slate-900 border border-slate-800"
              />
            </div>
          )}
          <div className="tooltip-arrow absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-950/95" />
        </div>
      )}
    </GlossaryContext.Provider>
  );
}
