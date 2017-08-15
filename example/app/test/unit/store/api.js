import * as api from '../../../store/api';
import $ from 'jquery.sap.global';

QUnit.module('store/api');

QUnit.test('doPing()', assert => {
  const ajax = $.ajax;

  $.ajax = (param) => {
    assert.equal(param.url, 'api/ping');
    assert.equal(param.type, 'get');
    assert.equal(param.cache, false);
    assert.equal(param.dataType, 'json');
  };

  api.doPing();

  $.ajax = ajax;
});
