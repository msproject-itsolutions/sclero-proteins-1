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
    }
  }
});

export const { setRegion, setSessionId } = regionSlice.actions;
export default regionSlice.reducer;
