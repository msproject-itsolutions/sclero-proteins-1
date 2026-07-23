import React from 'react';

function findEggOIndex(value, preferBrandWord) {
  if (preferBrandWord) {
    const brandMatch = /(?:sclero|ovomatrix)/i.exec(value);
    if (brandMatch) {
      const localIndex = brandMatch[0].search(/o/i);
      if (localIndex >= 0) return brandMatch.index + localIndex;
    }
  }
  return value.search(/o/i);
}

export default function EggOText({ text, tone = 'light', preferBrandWord = true }) {
  const value = String(text || '');
  const eggIndex = findEggOIndex(value, preferBrandWord);
  if (eggIndex < 0) return value;

  // The egg artwork replaces the letterform, so it must be sized to the case
  // of the "o" it stands in for (cap height vs x-height).
  const caseClass = value[eggIndex] === 'O' ? 'egg-o--upper' : 'egg-o--lower';

  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">
        {value.slice(0, eggIndex)}
        <span className={`egg-o egg-o--${tone} ${caseClass}`}>
          <span className="egg-o__fill" />
          <span className="egg-o__glyph">{value[eggIndex]}</span>
        </span>
        {value.slice(eggIndex + 1)}
      </span>
    </>
  );
}

