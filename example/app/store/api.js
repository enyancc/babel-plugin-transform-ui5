import $ from 'jquery.sap.global';

export function doPing() {
  return $.ajax({
    url: 'api/ping',
    type: 'get',
    cache: false,
    dataType: 'json'
  });
}
