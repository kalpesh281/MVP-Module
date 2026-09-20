import { createSlice } from '@reduxjs/toolkit';

/**
 * Which fixes the user has ticked. That is the whole state.
 *
 * Everything derived from it — the new score, the new grade, the new
 * premium, the saving — is computed in `utils/simulate.js` at render time
 * from data already in the `result` payload. Nothing here triggers a
 * request, which is what Gate 1 §1.5 checks with the Network tab open.
 *
 * A Set would be the natural type and is deliberately not used: Redux
 * requires serialisable state, and a Set in the store breaks time-travel
 * debugging and any future persistence. An array of ids, converted to a
 * Set at the point of use, costs nothing at this size.
 */
const initialState = {
  selected: [],
  // Which cover amount the reader is looking at. `null` means the
  // recommended one.
  //
  // It lives here rather than in the coverage block's own state because
  // it changes the headline premium, the rail, and what the fix simulator
  // prices against. Held locally it would have produced two different
  // premiums on one screen — the block's, and everything else's — with no
  // way for the reader to tell which one was theirs.
  limit: null,
  // Set when the user has ticked and unticked everything back to zero.
  // Gate 1 §1.5: "unticking reverses it exactly". Tracking that we have
  // returned to the baseline lets the UI say so rather than silently
  // showing the original number as though nothing happened.
  touched: false,
};

const simulatorSlice = createSlice({
  name: 'simulator',
  initialState,
  reducers: {
    fixToggled(state, action) {
      const id = action.payload;
      const index = state.selected.indexOf(id);
      if (index === -1) state.selected.push(id);
      else state.selected.splice(index, 1);
      state.touched = true;
    },
    allFixesSelected(state, action) {
      state.selected = [...action.payload];
      state.touched = true;
    },
    simulatorCleared(state) {
      state.selected = [];
      state.touched = true;
    },
    limitChosen(state, action) {
      state.limit = action.payload;
    },
    simulatorReset() {
      return initialState;
    },
  },
});

export const {
  fixToggled, allFixesSelected, simulatorCleared, simulatorReset, limitChosen,
} =
  simulatorSlice.actions;

export const selectSelectedIds = (state) => state.simulator.selected;
export const selectLimit = (state) => state.simulator.limit;
export const selectIsSelected = (id) => (state) =>
  state.simulator.selected.includes(id);
export const selectHasSelection = (state) => state.simulator.selected.length > 0;

export default simulatorSlice.reducer;
