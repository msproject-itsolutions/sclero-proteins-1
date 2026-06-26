import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getApiUrl } from '../lib/api';

const ACCESS_KEY = 'sclero_access';
const REFRESH_KEY = 'sclero_refresh';

function loadTokens() {
  if (typeof window === 'undefined') return { access: null, refresh: null };
  return {
    access: window.localStorage.getItem(ACCESS_KEY),
    refresh: window.localStorage.getItem(REFRESH_KEY),
  };
}

function persistTokens(access, refresh) {
  if (typeof window === 'undefined') return;
  if (access) window.localStorage.setItem(ACCESS_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

// Register a new customer. Backend returns { user, tokens }.
export const register = createAsyncThunk(
  'auth/register',
  async ({ email, password, first_name, last_name, phone_number }, { rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/register/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, first_name, last_name, phone_number }),
    });
    const data = await res.json();
    if (!res.ok) {
      // DRF returns field-keyed error arrays — surface the first readable message.
      const msg =
        data.email?.[0] || data.password?.[0] || data.detail || 'Registration failed';
      return rejectWithValue(msg);
    }
    persistTokens(data.tokens.access, data.tokens.refresh);
    return data;
  }
);

// Password login via simplejwt TokenObtainPair → { access, refresh }.
// If the backend returns `{ otp_required: true }` (staff TOTP gate), we set
// `requiresTotp` and stash the creds so `completeLogin(code)` can resubmit.
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { dispatch, rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/login/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return rejectWithValue(data.detail || 'Invalid email or password');
    }
    // Staff TOTP challenge — do NOT persist tokens.
    if (data.otp_required) {
      return { otpRequired: true, email, password };
    }
    // Legacy email-OTP path (kept for backward compat).
    if (data.two_factor_required) {
      return { tokens: data, user: null };
    }
    if (data.access) {
      persistTokens(data.access, data.refresh);
    }
    const profile = await dispatch(fetchProfile()).unwrap().catch(() => null);
    return { tokens: data, user: profile };
  }
);

// Google sign-in. Takes the decoded Google profile (email + sub id) and
// exchanges it with the backend for our own JWT pair. Only ever called by the
// env-gated GoogleSignInButton, so it's inert unless Google is configured.
export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async ({ email, googleId, firstName, lastName }, { rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/google/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, googleId, firstName, lastName }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.error || 'Google sign-in failed');
    persistTokens(data.tokens.access, data.tokens.refresh);
    return data; // { user, tokens }
  }
);

// Resubmit login with the TOTP code stashed from the first leg.
export const completeLogin = createAsyncThunk(
  'auth/completeLogin',
  async ({ totpCode }, { getState, dispatch, rejectWithValue }) => {
    const { pendingEmail, pendingPassword } = getState().auth;
    if (!pendingEmail || !pendingPassword) {
      return rejectWithValue('Login session expired. Please log in again.');
    }
    const res = await fetch(getApiUrl('/api/auth/login/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pendingEmail,
        password: pendingPassword,
        totp_code: totpCode,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return rejectWithValue(data.detail || 'Invalid authenticator code');
    }
    if (data.otp_required) {
      return rejectWithValue('Authenticator code required.');
    }
    persistTokens(data.access, data.refresh);
    const profile = await dispatch(fetchProfile()).unwrap().catch(() => null);
    return { tokens: data, user: profile };
  }
);

// --- TOTP (authenticator app) management ----------------------------------
function authHeader(getState) {
  const access = getState().auth.access || loadTokens().access;
  return access ? { Authorization: `Bearer ${access}` } : {};
}

export const fetch2faStatus = createAsyncThunk(
  'auth/fetch2faStatus',
  async (_, { getState, rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/2fa/status/'), {
      headers: { ...authHeader(getState) },
    });
    if (!res.ok) return rejectWithValue('Could not load 2FA status');
    return res.json();
  }
);

export const setup2fa = createAsyncThunk(
  'auth/setup2fa',
  async (_, { getState, rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/2fa/setup/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(getState) },
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.detail || 'Could not start 2FA setup');
    return data; // { secret, provisioning_uri, qr_data_url }
  }
);

export const verify2fa = createAsyncThunk(
  'auth/verify2fa',
  async ({ code }, { getState, rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/2fa/verify/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(getState) },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.detail || 'Invalid code');
    return data; // { enabled, backup_codes: [...] }
  }
);

export const disable2fa = createAsyncThunk(
  'auth/disable2fa',
  async ({ password, code }, { getState, rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/2fa/disable/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(getState) },
      body: JSON.stringify({ password, code }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.detail || 'Could not disable 2FA');
    return data;
  }
);

// Request a one-time passcode for an email (or phone). In sandbox the backend
// returns the code in `otp_preview_for_sandbox` for easy testing.
export const sendOtp = createAsyncThunk(
  'auth/sendOtp',
  async ({ identifier }, { rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/otp/send/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.error || 'Could not send code');
    return data; // { message, otp_preview_for_sandbox }
  }
);

// Request a magic sign-in link by email. Sandbox returns the link for testing.
export const requestMagicLink = createAsyncThunk(
  'auth/requestMagicLink',
  async ({ email }, { rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/magic-link/request/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.error || 'Could not send the link');
    return data; // { message, magic_link_for_sandbox }
  }
);

// Exchange a magic-link token for JWT → { user, tokens }.
export const verifyMagicLink = createAsyncThunk(
  'auth/verifyMagicLink',
  async ({ token }, { rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/magic-link/verify/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.error || 'Invalid sign-in link');
    persistTokens(data.tokens.access, data.tokens.refresh);
    return data;
  }
);

// Verify the OTP → returns { user, tokens }.
export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async ({ identifier, otp }, { rejectWithValue }) => {
    const res = await fetch(getApiUrl('/api/auth/otp/verify/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, otp }),
    });
    const data = await res.json();
    if (!res.ok) return rejectWithValue(data.error || 'Invalid code');
    persistTokens(data.tokens.access, data.tokens.refresh);
    return data;
  }
);

// Fetch the authenticated user's profile using the stored access token.
export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { getState, rejectWithValue }) => {
    const access = getState().auth.access || loadTokens().access;
    if (!access) return rejectWithValue('Not authenticated');
    const res = await fetch(getApiUrl('/api/auth/profile/'), {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!res.ok) return rejectWithValue('Session expired');
    return res.json();
  }
);

const initial = loadTokens();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    access: initial.access,
    refresh: initial.refresh,
    status: 'idle', // idle | loading | succeeded | failed
    error: null,
    twoFactorRequired: false,
    twoFactorEmail: '',
    sandboxOtp: '',
    // Staff TOTP gate (authenticator app)
    requiresTotp: false,
    pendingEmail: '',
    pendingPassword: '',
  },
  reducers: {
    logout(state) {
      clearTokens();
      state.user = null;
      state.access = null;
      state.refresh = null;
      state.status = 'idle';
      state.error = null;
      state.twoFactorRequired = false;
      state.twoFactorEmail = '';
      state.sandboxOtp = '';
      state.requiresTotp = false;
      state.pendingEmail = '';
      state.pendingPassword = '';
    },
    clearAuthError(state) {
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

    builder
      .addCase(register.pending, pending)
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.access = action.payload.tokens.access;
        state.refresh = action.payload.tokens.refresh;
      })
      .addCase(register.rejected, rejected)

      .addCase(login.pending, pending)
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.payload.otpRequired) {
          // Staff TOTP gate — stash creds for completeLogin.
          state.requiresTotp = true;
          state.pendingEmail = action.payload.email;
          state.pendingPassword = action.payload.password;
          return;
        }
        if (action.payload.tokens && action.payload.tokens.two_factor_required) {
          state.twoFactorRequired = true;
          state.twoFactorEmail = action.payload.tokens.email;
          state.sandboxOtp = action.payload.tokens.otp_preview_for_sandbox || '';
        } else if (action.payload.tokens) {
          state.access = action.payload.tokens.access;
          state.refresh = action.payload.tokens.refresh;
          if (action.payload.user) state.user = action.payload.user;
          state.twoFactorRequired = false;
          state.twoFactorEmail = '';
          state.sandboxOtp = '';
        }
      })
      .addCase(login.rejected, rejected)

      .addCase(googleLogin.pending, pending)
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.access = action.payload.tokens.access;
        state.refresh = action.payload.tokens.refresh;
      })
      .addCase(googleLogin.rejected, rejected)

      .addCase(completeLogin.pending, pending)
      .addCase(completeLogin.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.access = action.payload.tokens.access;
        state.refresh = action.payload.tokens.refresh;
        if (action.payload.user) state.user = action.payload.user;
        state.requiresTotp = false;
        state.pendingEmail = '';
        state.pendingPassword = '';
      })
      .addCase(completeLogin.rejected, rejected)

      .addCase(verifyOtp.pending, pending)
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.access = action.payload.tokens.access;
        state.refresh = action.payload.tokens.refresh;
        state.twoFactorRequired = false;
        state.twoFactorEmail = '';
        state.sandboxOtp = '';
      })
      .addCase(verifyOtp.rejected, rejected)

      .addCase(verifyMagicLink.pending, pending)
      .addCase(verifyMagicLink.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.access = action.payload.tokens.access;
        state.refresh = action.payload.tokens.refresh;
      })
      .addCase(verifyMagicLink.rejected, rejected)

      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(fetchProfile.rejected, (state) => {
        // Token invalid/expired — drop it so the UI shows logged-out.
        clearTokens();
        state.user = null;
        state.access = null;
        state.refresh = null;
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
