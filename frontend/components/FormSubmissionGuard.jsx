'use client';

import { useEffect } from 'react';

const TEXT_CONTROLS = 'input:not([type]), input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="search"], input[type="password"], textarea';

/**
 * Native `required` validation considers spaces to be a value. This capture-
 * phase guard closes that browser gap for every current and future form while
 * each form's own handler remains responsible for field-specific validation.
 */
export default function FormSubmissionGuard() {
  useEffect(() => {
    const clearWhitespaceError = (event) => {
      if (event.target?.matches?.(TEXT_CONTROLS)) event.target.setCustomValidity('');
    };

    const rejectWhitespaceOnlyRequiredField = (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const invalid = Array.from(form.elements).find((control) => (
        control.matches?.(TEXT_CONTROLS)
        && control.required
        && typeof control.value === 'string'
        && !control.value.trim()
      ));
      if (!invalid) return;

      event.preventDefault();
      event.stopPropagation();
      invalid.setCustomValidity('Please enter a value that is not only spaces.');
      invalid.reportValidity();
      invalid.focus();
    };

    document.addEventListener('input', clearWhitespaceError, true);
    document.addEventListener('submit', rejectWhitespaceOnlyRequiredField, true);
    return () => {
      document.removeEventListener('input', clearWhitespaceError, true);
      document.removeEventListener('submit', rejectWhitespaceOnlyRequiredField, true);
    };
  }, []);

  return null;
}
