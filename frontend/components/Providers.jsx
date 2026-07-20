"use client";

import React, { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from '../store';
import { fetchProfile } from '../store/authSlice';
import GlossaryProvider from './GlossaryContext';
import FormSubmissionGuard from './FormSubmissionGuard';

function SessionBootstrap({ children }) {
  const dispatch = useDispatch();
  const sessionChecked = useSelector((state) => state.auth.sessionChecked);

  useEffect(() => {
    if (!sessionChecked) dispatch(fetchProfile());
  }, [dispatch, sessionChecked]);

  return children;
}

export default function Providers({ children }) {
  return (
    <Provider store={store}>
      <SessionBootstrap>
        <GlossaryProvider>
          <FormSubmissionGuard />
          {children}
        </GlossaryProvider>
      </SessionBootstrap>
    </Provider>
  );
}
