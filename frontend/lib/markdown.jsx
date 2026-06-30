import React from 'react';

function safeContentUrl(value, { images = false } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return raw.startsWith('//') ? '' : raw;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (images && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function renderStyledText(text, keyPrefix) {
  const parts = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={`${keyPrefix}-b-${match.index}`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={`${keyPrefix}-i-${match.index}`}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function renderInlineMarkdown(line, keyPrefix = 'md') {
  const nodes = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(line || '')) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderStyledText(line.slice(lastIndex, match.index), `${keyPrefix}-${lastIndex}`));
    }
    const href = safeContentUrl(match[2]);
    if (href) {
      nodes.push(
        <a
          key={`${keyPrefix}-a-${match.index}`}
          href={href}
          className="text-brand-purple underline"
          target="_blank"
          rel="noreferrer"
        >
          {renderStyledText(match[1], `${keyPrefix}-al-${match.index}`)}
        </a>
      );
    } else {
      nodes.push(match[1]);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < (line || '').length) {
    nodes.push(...renderStyledText((line || '').slice(lastIndex), `${keyPrefix}-${lastIndex}`));
  }
  return nodes;
}

export function parseMarkdownBlocks(content) {
  const lines = (content || '').split(/\r?\n/);
  const blocks = [];
  let listBuffer = [];
  const flushList = () => {
    if (listBuffer.length) {
      blocks.push({ type: 'ul', items: [...listBuffer] });
      listBuffer = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      blocks.push({ type: 'space', key: idx });
      return;
    }
    if (line.startsWith('## ')) {
      flushList();
      blocks.push({ type: 'h2', text: line.slice(3), key: idx });
      return;
    }
    if (line.startsWith('# ')) {
      flushList();
      blocks.push({ type: 'h1', text: line.slice(2), key: idx });
      return;
    }
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushList();
      blocks.push({
        type: 'image',
        alt: imageMatch[1],
        src: safeContentUrl(imageMatch[2], { images: true }),
        key: idx,
      });
      return;
    }
    if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
      return;
    }
    flushList();
    blocks.push({ type: 'p', text: line, key: idx });
  });
  flushList();
  return blocks;
}
