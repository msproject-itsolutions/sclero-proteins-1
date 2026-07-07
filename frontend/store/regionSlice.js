import { createSlice } from '@reduxjs/toolkit';
import { getApiUrl } from '../lib/api';

const initialState = {
  currentRegion: 'UK', // Default
  currencyCode: 'GBP',
  currencySymbol: '£',
  taxName: 'VAT',
  taxRate: 20.00,
  domain: 'scleroproteins.co.uk',
  apiUrl: getApiUrl(),
  session_id: '',
  // Store-wide tax display mode: 'inclusive' (price includes tax) or
  // 'exclusive' (tax added at checkout). Loaded from /api/store-config/.
  taxMode: 'inclusive',
  guestCheckoutEnabled: true,
  branding: {
    logoUrl: '',
    logoWordmarkUrl: '',
    whatsappNumberIN: '918047100000',
    whatsappNumberUK: '442045740000',
    emailIN: 'support@scleroproteins.in',
    emailUK: 'support@scleroproteins.co.uk',
    phoneIN: '+91 80 4710 0000',
    phoneUK: '+44 (0)20 4574 0000',
  }
};

const regionSlice = createSlice({
  name: 'region',
  initialState,
  reducers: {
    setRegion: (state, action) => {
      const region = action.payload; // expects { code, name, currency_code, currency_symbol, tax_name, tax_rate, domain }
      state.currentRegion = region.code;
      state.currencyCode = region.currency_code;
      state.currencySymbol = region.currency_symbol;
      state.taxName = region.tax_name;
      state.taxRate = parseFloat(region.tax_rate);
      state.domain = region.domain;
    },
    setSessionId: (state, action) => {
      state.session_id = action.payload;
    },
    setTaxMode: (state, action) => {
      state.taxMode = action.payload === 'exclusive' ? 'exclusive' : 'inclusive';
    },
    setGuestCheckoutEnabled: (state, action) => {
      state.guestCheckoutEnabled = Boolean(action.payload);
    },
    setBranding: (state, action) => {
      state.branding = { ...state.branding, ...action.payload };
    }
  }
});

export const { setRegion, setSessionId, setTaxMode, setGuestCheckoutEnabled, setBranding } = regionSlice.actions;
export default regionSlice.reducer;

