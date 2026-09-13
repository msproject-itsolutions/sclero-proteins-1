import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { postJson } from '../lib/api';
import { authenticatedFetch } from '../lib/authFetch';

// The server identifies the cart by its HttpOnly cookie (or the signed-in
// account); the browser never chooses, stores or sends a cart id.
const regionFor = (region, getState) => region || getState()?.region?.currentRegion || 'UK';

async function postCart(path, payload, fallbackMessage) {
  const { response, data } = await postJson(path, payload);
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
}

export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async ({ region } = {}, { rejectWithValue, getState }) => {
    try {
      const response = await authenticatedFetch(
        `/api/cart/?region=${encodeURIComponent(regionFor(region, getState))}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch cart');
      }
      return await response.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async ({ region, product_id, quantity, metadata, variant_sku }, { rejectWithValue, getState }) => {
    try {
      return await postCart('/api/cart/add/', {
        region: regionFor(region, getState),
        product_id,
        quantity: quantity || 1,
        metadata,
        variant_sku,
      }, 'Failed to add item to cart');
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async ({ region, cart_item_id, product_id, variant_sku, quantity }, { rejectWithValue, getState }) => {
    try {
      return await postCart('/api/cart/update/', {
        region: regionFor(region, getState),
        cart_item_id,
        product_id,
        variant_sku,
        quantity,
      }, 'Failed to update item quantity');
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const removeFromCart = createAsyncThunk(
  'cart/removeFromCart',
  async ({ region, cart_item_id, product_id, variant_sku }, { rejectWithValue, getState }) => {
    try {
      return await postCart('/api/cart/remove/', {
        region: regionFor(region, getState),
        cart_item_id,
        product_id,
        variant_sku,
      }, 'Failed to remove item');
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const clearCart = createAsyncThunk(
  'cart/clearCart',
  async ({ region } = {}, { rejectWithValue, getState }) => {
    try {
      return await postCart('/api/cart/clear/', { region: regionFor(region, getState) }, 'Failed to clear cart');
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
