import { createSlice } from '@reduxjs/toolkit';

/** Small, persisted preferences. Nothing here affects a number.
 *
 *  There is deliberately no theme setting: the platform has one theme.
 *  A toggle implies two designs to maintain, two sets of contrast ratios
 *  to check, and two ways for the grade colours to read differently to
 *  two people looking at the same report. */
const initialState = {
  recentDomains: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    domainRemembered(state, action) {
      const domain = action.payload;
      if (!domain) return;
      state.recentDomains = [
        domain,
        ...state.recentDomains.filter((d) => d !== domain),
      ].slice(0, 5);
    },
  },
});

export const { domainRemembered } = uiSlice.actions;
export const selectRecentDomains = (state) => state.ui.recentDomains;

export default uiSlice.reducer;
