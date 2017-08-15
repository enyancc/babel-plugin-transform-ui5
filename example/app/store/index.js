import * as actions from './actions';
import JSONModel from 'sap/ui/model/json/JSONModel';

let state = null;

export function getState() {
  if (!state) {
    state = new JSONModel({
      app: {
        value: 0,
      }
    });
  }

  return state;
}

export function setModel(controller) {
  controller.getView().setModel(getState());
}

export async function dispatch(actionName, ...payload) {
  if (!actions[actionName]) {
    return console.error(`"${actionName}" is not registered!`);
  }

  try {
    return actions[actionName]({ state, dispatch }, ...payload);
  } catch (err) {
    console.error(`Error during dispatch of '${actionName}'`, err);
  }
}
