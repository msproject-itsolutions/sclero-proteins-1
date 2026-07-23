'use client';

import React from 'react';
import { useGlossary } from './GlossaryContext';

const MARKER_PATTERN = /\(\(([a-z0-9_]+)\)\)/gi;
const WORD_PATTERN = /[\p{L}\p{N}]+(?:[’'\-–][\p{L}\p{N}]+)*/gu;
const GENERIC_CODE_WORDS = new Set([
  'activation', 'behavior', 'behaviour', 'dynamics', 'effect', 'enhancement',
  'interaction', 'mechanism', 'optimization', 'pathway', 'process', 'profile',
  'response', 'support', 'system',
]);
const LEADING_FILLER_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'by', 'can', 'creates',
  'for', 'from', 'has', 'have', 'helps', 'in', 'into', 'is', 'it', 'of', 'on',
  'or', 'that', 'the', 'their', 'these', 'this', 'through', 'to', 'with', 'your',
]);

function normalizeWord(word) {
  return word
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function wordsAreRelated(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  const shortest = Math.min(left.length, right.length);
  return shortest >= 5 && left.slice(0, shortest - 1) === right.slice(0, shortest - 1);
}

function codeToLabel(code) {
  const acronyms = { esc: 'ESC', esm: 'ESM', mmp: 'MMP', lox: 'LOX', ph: 'pH', uv: 'UV', atp: 'ATP' };
  return code
    .split('_')
    .map((word) => acronyms[word] || `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function cleanContext(text) {
  return text
    .replace(MARKER_PATTERN, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[—–:-]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function contextualDefinition(text, markerStart, markerEnd) {
  const before = text.slice(0, markerStart);
  const after = text.slice(markerEnd);
  const sentenceStart = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
    before.lastIndexOf('\n'),
  ) + 1;

  const endings = ['.', '!', '?', '\n']
    .map((character) => after.indexOf(character))
    .filter((index) => index >= 0);
  const sentenceEnd = endings.length ? markerEnd + Math.min(...endings) + 1 : text.length;
  return cleanContext(text.slice(sentenceStart, sentenceEnd));
}

function inferPhraseRange(text, term, code) {
  const sentenceStart = Math.max(
    text.lastIndexOf('.'),
    text.lastIndexOf('!'),
    text.lastIndexOf('?'),
    text.lastIndexOf('\n'),
  ) + 1;
  const sentence = text.slice(sentenceStart);
  const exactTermIndex = sentence.toLocaleLowerCase().lastIndexOf(term.toLocaleLowerCase());
  if (exactTermIndex >= 0) {
    return {
      start: sentenceStart + exactTermIndex,
      end: sentenceStart + exactTermIndex + term.length,
    };
  }

  const words = Array.from(sentence.matchAll(WORD_PATTERN)).map((match) => ({
    start: sentenceStart + match.index,
    end: sentenceStart + match.index + match[0].length,
    normalized: normalizeWord(match[0]),
  }));
  if (!words.length) return null;

  const conceptWords = code
    .split('_')
    .map(normalizeWord)
    .filter((word) => word && !GENERIC_CODE_WORDS.has(word));

  let best = null;
  for (let start = 0; start < words.length; start += 1) {
    for (let length = 1; length <= 6 && start + length <= words.length; length += 1) {
      const window = words.slice(start, start + length);
      const matches = new Set();
      window.forEach((word) => {
        conceptWords.forEach((conceptWord) => {
          if (wordsAreRelated(word.normalized, conceptWord)) matches.add(conceptWord);
        });
      });
      if (!matches.size) continue;

      const unmatched = length - matches.size;
      const distance = words.length - (start + length);
      const score = matches.size * 5 - unmatched * 0.45 - distance * 0.05 + Math.min(length, 3) * 0.1;
      if (!best || score > best.score) {
        best = { start, length, score, matches: matches.size };
      }
    }
  }

  if (best) {
    let start = best.start;
    let end = best.start + best.length - 1;
    if (best.matches === 1 && best.length === 1) {
      let expansion = 0;
      while (start > 0 && expansion < 2 && !LEADING_FILLER_WORDS.has(words[start - 1].normalized)) {
        start -= 1;
        expansion += 1;
      }
    }
    return { start: words[start].start, end: words[end].end };
  }

  let start = Math.max(0, words.length - 3);
  while (start < words.length - 1 && LEADING_FILLER_WORDS.has(words[start].normalized)) start += 1;
  return { start: words[start].start, end: words[words.length - 1].end };
}

function GlossaryTrigger({ phrase, term }) {
  return (
    <button
      type="button"
      className="glossary-highlight"
      data-term={term.term}
      data-definition={term.definition}
      data-category={term.category || ''}
      data-image={term.image_url || ''}
      aria-label={`${phrase}. Open definition for ${term.term}`}
      aria-haspopup="dialog"
    >
      {phrase}
    </button>
  );
}

export default function GlossaryText({ text }) {
  const { getTermByCode } = useGlossary();
  const source = String(text || '');
  const output = [];
  let cursor = 0;
  let match;

  MARKER_PATTERN.lastIndex = 0;
  while ((match = MARKER_PATTERN.exec(source)) !== null) {
    const markerEnd = MARKER_PATTERN.lastIndex;
    const code = match[1].toLowerCase();
    const resolved = getTermByCode(code);
    const fallbackDefinition = contextualDefinition(source, match.index, markerEnd);
    const term = resolved || {
      term: codeToLabel(code),
      definition: fallbackDefinition || 'This concept is explained in the surrounding article context.',
      category: 'Knowledge Hub',
      image_url: '',
    };
    const beforeMarker = source.slice(cursor, match.index);

    if (!beforeMarker.trim()) {
      if (beforeMarker) output.push(beforeMarker);
      output.push(<GlossaryTrigger key={`term-${match.index}`} phrase={term.term} term={term} />);
    } else {
      const phraseRange = inferPhraseRange(beforeMarker, term.term, code);
      if (phraseRange) {
        const prefix = beforeMarker.slice(0, phraseRange.start);
        const phrase = beforeMarker.slice(phraseRange.start, phraseRange.end);
        const suffix = beforeMarker.slice(phraseRange.end);
        if (prefix) output.push(prefix);
        output.push(<GlossaryTrigger key={`term-${match.index}`} phrase={phrase} term={term} />);
        if (suffix) output.push(suffix);
      } else {
        output.push(beforeMarker);
      }
    }

    cursor = markerEnd;
    MARKER_PATTERN.lastIndex = markerEnd;
  }

  if (cursor < source.length) output.push(source.slice(cursor));
  return output.length ? output : source;
}
