import * as api from '../api';
import MessageToast from 'sap/m/MessageToast';

export async function exampleButtonClick({ state, dispatch }, listId) {
  MessageToast.show('Example Button Clicked');

  state.setProperty('/app/value', state.getProperty('/app/value') + 1);
}
