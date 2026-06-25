'use client';

import React, { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { googleLogin } from '../store/authSlice';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Decode a Google ID-token (JWT) payload without a library.
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Renders the official Google sign-in button — but ONLY when
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured. Until then it renders nothing, so
 * the login UI never shows an unavailable provider.
 */
export default function GoogleSignInButton({ onError }) {
  const dispatch = useDispatch();
  const containerRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID || typeof window === 'undefined') return;

    const handleCredential = (response) => {
      const profile = decodeJwt(response?.credential);
      if (!profile?.email) {
        onError?.('Could not read your Google account.');
        return;
      }
      dispatch(
        googleLogin({
          email: profile.email,
          googleId: profile.sub,
          firstName: profile.given_name || '',
          lastName: profile.family_name || '',
        })
      )
        .unwrap()
        .catch((e) => onError?.(typeof e === 'string' ? e : 'Google sign-in failed'));
    };

    const init = () => {
      if (!window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'pill',
      });
    };

    // Load the Google Identity Services script once.
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing && window.google?.accounts?.id) {
      init();
    } else if (existing) {
      existing.addEventListener('load', init, { once: true });
    } else {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', init, { once: true });
      document.body.appendChild(script);
    }
  }, [dispatch, onError]);

  if (!CLIENT_ID) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
