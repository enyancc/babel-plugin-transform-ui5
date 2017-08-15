import UIComponent from 'sap/ui/core/UIComponent';
import AppController from './controller/App';

export default class Component extends UIComponent {

  metadata = { manifest: 'json' }

  init(...args) {
    UIComponent.prototype.init.call(this, ...args);
  }

}
