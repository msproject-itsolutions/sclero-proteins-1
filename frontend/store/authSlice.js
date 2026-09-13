import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getApiUrl } from '../lib/api';
import { authenticatedFetch } from '../lib/authFetch';

const authRequest = (path, options = {}) => fetch(getApiUrl(path), {
  ...options,
  credentials: 'include',
  headers: {
    'X-Sclero-Client': 'storefront',
    ...(options.headers || {}),
  },
});

async function postAuth(path, payload) {
  const res = await authRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

const cleanEmail = (value) => String(value || '').trim().toLowerCase();
// Challenge errors after which only a fresh password sign-in can help.
const RESTART_CODES = ['invalid', 'expired', 'locked', 'send_limit'];

// Register a new customer. Backend returns { user, tokens } (tokens become cookies).
export const register = createAsyncThunk(
  'auth/register',
  async ({ email, password, first_name, last_name, phone_number }, { rejectWithValue }) => {
    const { res, data } = await postAuth('/api/auth/register/', {
      email: cleanEmail(email),
      password,
      first_name: String(first_name || '').trim(),
      last_name: String(last_name || '').trim(),
      phone_number: String(phone_number || '').trim(),
    });
    if (!res.ok) {
      // DRF returns field-keyed error arrays — surface the first readable message.
      return rejectWithValue(data.email?.[0] || data.password?.[0] || data.detail || 'Registration failed');
    }
    return data;
  }
);

// Password sign-in. Staff, and customers who turned on two-step sign-in, get
// an emailed code instead of a session. The password is never stored: the
// second step only needs the challenge id and the code.
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { dispatch, rejectWithValue }) => {
    const { res, data } = await postAuth('/api/auth/login/', { email: cleanEmail(email), password });
    if (!res.ok) return rejectWithValue(data.detail || 'Invalid email or password');
    if (data.challenge_required) {
      return {
        challenge: {
          id: data.challenge_id,
          sentTo: data.sent_to_masked || '',
          resendIn: data.resend_available_in || 60,
          sentAt: Date.now(),
          sandboxCode: data.otp_preview_for_sandbox || '',
          // The email failed; the backend explains how to get a code instead.
          notice: data.delivery_failed ? (data.detail || '') : '',
        },
      };
    }
    const user = data.user || await dispatch(fetchProfile()).unwrap().catch(() => null);
    return { user };
  }
);

// Second step of password sign-in: exchange the emailed code for a session.
export const verifyLoginCode = createAsyncThunk(
  'auth/verifyLoginCode',
  async ({ code }, { getState, dispatch, rejectWithValue }) => {
    const { challengeId } = getState().auth;
    if (!challengeId) {
      return rejectWithValue({ message: 'Your sign-in expired. Please enter your password again.', restart: true });
    }
    const { res, data } = await postAuth('/api/auth/login/verify/', { challenge_id: challengeId, code });
    if (!res.ok) {
      return rejectWithValue({
        message: data.detail || 'That code is not correct.',
        restart: RESTART_CODES.includes(data.code),
      });
    }
    const user = data.user || await dispatch(fetchProfile()).unwrap().catch(() => null);
    return { user };
  }
);

export const resendLoginCode = createAsyncThunk(
  'auth/resendLoginCode',
  async (_, { getState, rejectWithValue }) => {
    const { challengeId } = getState().auth;
    const { res, data } = await postAuth('/api/auth/login/resend/', { challenge_id: challengeId });
    if (!res.ok) {
      return rejectWithValue({
        message: data.detail || 'Could not send a new code.',
        restart: RESTART_CODES.includes(data.code),
      });
    }
    return {
      sentTo: data.sent_to_masked || '',
      resendIn: data.resend_available_in || 60,
      sentAt: Date.now(),
      sandboxCode: data.otp_preview_for_sandbox || '',
    };
  }
);

// Google sign-in. Only the Google ID token is sent; the backend verifies it.
// Only ever called by the env-gated GoogleSignInButton.
export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async ({ credential }, { rejectWithValue }) => {
    const { res, data } = await postAuth('/api/auth/google/', { credential });
    if (!res.ok) return rejectWithValue(data.error || 'Google sign-in failed');
    return data;
  }
);

// Request a one-time sign-in code by email. In sandbox the backend also
// returns the code in `otp_preview_for_sandbox`.
export const sendOtp = createAsyncThunk(
  'auth/sendOtp',
  async ({ identifier }, { rejectWithValue }) => {
    const { res, data } = await postAuth('/api/auth/otp/send/', { identifier: cleanEmail(identifier) });
    if (!res.ok) return rejectWithValue(data.error || 'Could not send code');
    return data;
  }
);

// Verify the emailed code for the challenge returned by sendOtp.
export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async ({ challengeId, otp }, { rejectWithValue }) => {
    const { res, data } = await postAuth('/api/auth/otp/verify/', {
      challenge_id: challengeId,
      otp: String(otp || '').trim(),
    });
    if (!res.ok) return rejectWithValue(data.error || 'Invalid code');
    return data;
  }
);

// Request a magic sign-in link by email. Sandbox returns the link for testing.
export const requestMagicLink = createAsyncThunk(
  'auth/requestMagicLink',
  async ({ email }, { rejectWithValue }) => {
    const { res, data } = await postAuth('/api/auth/magic-link/request/', {
      email: cleanEmail(email),
      origin: typeof window !== 'undefined' ? window.location.origin : '',
    });
    if (!res.ok) return rejectWithValue(data.error || 'Could not send the link');
    return data;
  }
);

export const verifyMagicLink = createAsyncThunk(
  'auth/verifyMagicLink',
  async ({ token }, { rejectWithValue }) => {
    const { res, data } = await postAuth('/api/auth/magic-link/verify/', { token });
    if (!res.ok) return rejectWithValue(data.error || 'Invalid sign-in link');
    return data;
  }
);

// Fetch the signed-in user's profile using the HttpOnly session cookie.
export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue }) => {
    const res = await authenticatedFetch('/api/auth/profile/');
    if (!res.ok) return rejectWithValue('Session expired');
    return res.json();
  }
);

const noChallenge = {
  challengeId: '',
  challengeSentTo: '',
  challengeSentAt: 0,
  challengeResendIn: 0,
  challengeNotice: '',
  sandboxOtp: '',
};

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    sessionChecked: false,
    status: 'idle', // idle | loading | succeeded | failed
    error: null,
    // A password sign-in waiting for its emailed code.
    ...noChallenge,
  },
  reducers: {
    clearSession(state) {
      Object.assign(state, noChallenge);
      state.user = null;
      state.isAuthenticated = false;
      state.sessionChecked = true;
      state.status = 'idle';
      state.error = null;
    },
    clearAuthError(state) {
      state.error = null;
    },
    cancelChallenge(state) {
      Object.assign(state, noChallenge);
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const pending = (state) => {
      state.status = 'loading';
      state.error = null;
    };
    const rejected = (state, action) => {
      state.status = 'failed';
      state.error = action.payload || 'Something went wrong';
    };
    const challengeRejected = (state, action) => {
      state.status = 'failed';
      state.error = action.payload?.message || 'Something went wrong';
      if (action.payload?.restart) Object.assign(state, noChallenge);
    };
    const signedIn = (state, user) => {
      state.status = 'succeeded';
      if (user) state.user = user;
      state.isAuthenticated = true;
      state.sessionChecked = true;
      Object.assign(state, noChallenge);
    };

    builder
      .addCase(register.pending, pending)
      .addCase(register.fulfilled, (state, action) => signedIn(state, action.payload.user))
      .addCase(register.rejected, rejected)

      .addCase(login.pending, pending)
      .addCase(login.fulfilled, (state, action) => {
        const { challenge } = action.payload;
        if (!challenge) {
          signedIn(state, action.payload.user);
          return;
        }
        state.status = 'succeeded';
        state.challengeId = challenge.id;
        state.challengeSentTo = challenge.sentTo;
        state.challengeSentAt = challenge.sentAt;
        state.challengeResendIn = challenge.resendIn;
        state.challengeNotice = challenge.notice;
        state.sandboxOtp = challenge.sandboxCode;
      })
      .addCase(login.rejected, rejected)

      .addCase(verifyLoginCode.pending, pending)
      .addCase(verifyLoginCode.fulfilled, (state, action) => signedIn(state, action.payload.user))
      .addCase(verifyLoginCode.rejected, challengeRejected)

      .addCase(resendLoginCode.pending, pending)
      .addCase(resendLoginCode.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.challengeSentTo = action.payload.sentTo || state.challengeSentTo;
        state.challengeSentAt = action.payload.sentAt;
        state.challengeResendIn = action.payload.resendIn;
        // A new code was emailed, so an earlier delivery failure no longer applies.
        state.challengeNotice = '';
        state.sandboxOtp = action.payload.sandboxCode;
      })
      .addCase(resendLoginCode.rejected, challengeRejected)

      .addCase(googleLogin.pending, pending)
      .addCase(googleLogin.fulfilled, (state, action) => signedIn(state, action.payload.user))
      .addCase(googleLogin.rejected, rejected)

      .addCase(verifyOtp.pending, pending)
      .addCase(verifyOtp.fulfilled, (state, action) => signedIn(state, action.payload.user))
      .addCase(verifyOtp.rejected, rejected)

      .addCase(verifyMagicLink.pending, pending)
      .addCase(verifyMagicLink.fulfilled, (state, action) => signedIn(state, action.payload.user))
      .addCase(verifyMagicLink.rejected, rejected)

      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        state.sessionChecked = true;
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.sessionChecked = true;
      });
  },
});

export const { clearSession, clearAuthError, cancelChallenge } = authSlice.actions;
export const logout = () => (dispatch) => {
  authRequest('/api/auth/logout/', { method: 'POST' }).catch(() => {});
  dispatch(clearSession());
};
export default authSlice.reducer;
