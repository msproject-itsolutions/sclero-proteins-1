import React from 'react';

function findEggOIndexes(value, preferBrandWord) {
  if (preferBrandWord) {
    const brandIndexes = [...value.matchAll(/(?:sclero|ovomatrix)/gi)]
      .map((match) => match.index + match[0].search(/o/i))
      .filter((index) => index >= 0);
    if (brandIndexes.length) return brandIndexes;
  }

  const fallbackIndex = value.search(/o/i);
  return fallbackIndex >= 0 ? [fallbackIndex] : [];
}

export default function EggOText({ text, tone = 'light', preferBrandWord = true }) {
  const value = String(text || '');
  const eggIndexes = findEggOIndexes(value, preferBrandWord);
  if (!eggIndexes.length) return value;

  // The egg artwork replaces each branded letterform and is sized to the
  // original character case (cap height vs x-height).

  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">
        {eggIndexes.map((eggIndex, index) => {
          const caseClass = value[eggIndex] === 'O' ? 'egg-o--upper' : 'egg-o--lower';
          const previousIndex = index === 0 ? 0 : eggIndexes[index - 1] + 1;
          return (
            <React.Fragment key={eggIndex}>
              {value.slice(previousIndex, eggIndex)}
              <span className={`egg-o egg-o--${tone} ${caseClass}`}>
                <span className="egg-o__fill" />
                <span className="egg-o__glyph">{value[eggIndex]}</span>
              </span>
            </React.Fragment>
          );
        })}
        {value.slice(eggIndexes[eggIndexes.length - 1] + 1)}
      </span>
    </>
  );
}
