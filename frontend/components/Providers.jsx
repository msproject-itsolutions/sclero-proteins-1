"use client";

import React from 'react';
import { Provider } from 'react-redux';
import { store } from '../store';
import GlossaryProvider from './GlossaryContext';

export default function Providers({ children }) {
  return (
    <Provider store={store}>
      <GlossaryProvider>
        {children}
      </GlossaryProvider>
    </Provider>
  );
}
