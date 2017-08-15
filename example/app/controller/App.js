import Controller from 'sap/ui/core/mvc/Controller';
import { setModel, dispatch } from '../store';

export default class AppController extends Controller {

  onInit() {
    setModel(this);
  }

  onHelloWorldClick() {
    dispatch('exampleButtonClick')
  }

}
