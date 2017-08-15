import * as store from '../../../store';

QUnit.module('store/index');

QUnit.test('setModel()', assert => {
  let value = null;
  const controller = { getView: () => ({ setModel: v => (value = v) }) };

  store.setModel(controller);

  assert.ok(value);
});

QUnit.test('getState()', assert => {
  const state1 = store.getState();
  const state2 = store.getState();

  assert.equal(state1, state2);
  assert.ok(state1);
  assert.ok(state2);
});
