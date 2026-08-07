import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getApiUrl, postJson } from '../lib/api';
import { authenticatedFetch } from '../lib/authFetch';

function resolveActiveSessionId(passedSessionId, state) {
  let sid = passedSessionId || state?.region?.session_id;
  if (!sid && typeof window !== 'undefined') {
    sid = localStorage.getItem('sclero_session_id');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('sclero_session_id', sid);
    }
  }
  return sid || 'session_fallback';
}

export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async ({ session_id, region }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const activeSessionId = resolveActiveSessionId(session_id, state);
      const activeRegion = region || state?.region?.currentRegion || 'UK';

      const response = await authenticatedFetch(
        `/api/cart/?session_id=${encodeURIComponent(activeSessionId)}&region=${encodeURIComponent(activeRegion)}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch cart');
      }
      const data = await response.json();
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async ({ session_id, region, product_id, quantity, metadata, variant_sku }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const activeSessionId = resolveActiveSessionId(session_id, state);
      const activeRegion = region || state?.region?.currentRegion || 'UK';

      const { response, data } = await postJson('/api/cart/add/', {
        session_id: activeSessionId,
        region: activeRegion,
        product_id,
        quantity: quantity || 1,
        metadata,
        variant_sku,
      });
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add item to cart');
      }
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async ({ session_id, region, cart_item_id, product_id, variant_sku, quantity }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const activeSessionId = resolveActiveSessionId(session_id, state);
      const activeRegion = region || state?.region?.currentRegion || 'UK';

      const { response, data } = await postJson('/api/cart/update/', {
        session_id: activeSessionId,
        region: activeRegion,
        cart_item_id,
        product_id,
        variant_sku,
        quantity,
      });
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update item quantity');
      }
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const removeFromCart = createAsyncThunk(
  'cart/removeFromCart',
  async ({ session_id, region, cart_item_id, product_id, variant_sku }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const activeSessionId = resolveActiveSessionId(session_id, state);
      const activeRegion = region || state?.region?.currentRegion || 'UK';

      const { response, data } = await postJson('/api/cart/remove/', {
        session_id: activeSessionId,
        region: activeRegion,
        cart_item_id,
        product_id,
        variant_sku,
      });
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove item');
      }
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const clearCart = createAsyncThunk(
  'cart/clearCart',
  async ({ session_id, region }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const activeSessionId = resolveActiveSessionId(session_id, state);
      const activeRegion = region || state?.region?.currentRegion || 'UK';

      const { response, data } = await postJson('/api/cart/clear/', {
        session_id: activeSessionId,
        region: activeRegion,
      });
      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear cart');
      }
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    isLoading: false,
    error: null,
  },
  reducers: {
    clearCartLocal: (state) => {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.items = action.payload.items || [];
        state.isLoading = false;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(addToCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.items = action.payload.items || [];
        state.isLoading = false;
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(updateCartItem.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateCartItem.fulfilled, (state, action) => {
        state.items = action.payload.items || [];
        state.isLoading = false;
      })
      .addCase(updateCartItem.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(removeFromCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeFromCart.fulfilled, (state, action) => {
        state.items = action.payload.items || [];
        state.isLoading = false;
      })
      .addCase(removeFromCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(clearCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(clearCart.fulfilled, (state, action) => {
        state.items = action.payload?.items || [];
        state.isLoading = false;
      })
      .addCase(clearCart.rejected, (state, action) => {
        state.items = [];
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearCartLocal } = cartSlice.actions;
export default cartSlice.reducer;
