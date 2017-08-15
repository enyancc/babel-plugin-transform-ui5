# babel-plugin-transform-ui5 for Babel 6
An UNOFFICIAL Babel transform plugin for SAP UI5 modules. It transforms SAP UI5 module imports into `sap.ui.define()` format, while skips transformation for the other imports. The other imports should be handled by the packaging tool like webpack.

## Features
+ Class, inheritance and `super` keyword
+ UI5's `metadata` field
+ Static methods and fields

## Babel version
Currently this version only supports `Babel 6`.

## Usage with webpack

Suppose that in your project, all the source codes are stored in `app` folder.

```
<your-ui5-project>
    ├── <app>
    │   └── <your_module>
    │       └── <sub_folder>
    │           ├── ClassA.js
    │           └── ClassB.js
    ├── .babelrc
    ├── webpack.config.js
    └── package.json
```

### 1. Install the dependencies
```js
{
    ...
    "devDependencies": {
        "babel-core": "^6.25.0",
        "babel-loader": "^7.1.1",
        "babel-plugin-syntax-class-properties": "^6.13.0",
        "babel-plugin-transform-ui5": "^6.1.2",
        "babel-polyfill": "^6.23.0",
        "babel-preset-env": "^1.6.0",
        "webpack": "^3.4.1"
    }
    ...
}
```

```
$ npm install --save-dev babel-preset-transform-ui5 babel-plugin-syntax-class-properties
```

### 2. Configure .babelrc
Add `transform-ui5` to the `plugins` and pass the options to track the imports that should be transformed.
```json
{
   "sourceRoot": "./",
   "presets": [
    [
      "env",
      {
        "loose": true,
        "modules": false
      }
    ]
  ],
  "plugins": [
    "syntax-class-properties",
    ["transform-ui5", { "libs": ["^sap", "^jquery"], "files": ["app/controller", "app/model"] }]
  ]
}

```

> The `sourceRoot` property can helps the plugin to output the right namespace.

### 3. Configure webpack.config.js
Add a `gulpfile.js` in your project root folder.
```js
module.exports = {
  entry: {
    'Component': ['babel-polyfill', path.resolve(__dirname, 'app/Component.mjs')],
    'test/unit/allTests': ['babel-polyfill', path.resolve(__dirname, 'app/test/unit/allTests.mjs')]
  },
  output: {
    path: path.resolve(__dirname, 'app/'),
    filename: '[name].js'
  },
  // devtool: 'cheap-module-eval-source-map',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        loaders: [
          'babel-loader'
        ]
      }
    ]
  }
};
```

### 4. Build with Webpack
Please take a look at [example](https://github.com/sergiirocks/babel-plugin-transform-ui5/tree/master/example),
you'll find the answer.


## Compilation

### ES6 Codes
``` javascript
/*---------------------------------*
 * File: app/Component.mjs *
 *---------------------------------*/

import UIComponent from 'sap/ui/core/UIComponent';
import AppController from './controller/App';

export default class Component extends UIComponent {

  metadata = { manifest: 'json' }

  init(...args) {
    UIComponent.prototype.init.call(this, ...args);
  }

}


/*---------------------------------*
 * File: app/controller/App.js *
 *---------------------------------*/
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

/*---------------------------------*
 * File: app/store/index.js *
 *---------------------------------*/
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

```

## Compiled Codes
``` javascript
/*------------------------------------*
 * File: app/Component.mjs *
 *------------------------------------*/
import './controller/App';

var UIComponent;
var AppController;
sap.ui.define('app/Component', ['sap/ui/core/UIComponent', 'app/controller/App'], function (_UIComponent, _AppController) {
  UIComponent = _UIComponent
  AppController = _AppController
  return UIComponent.extend('app.Component', {
    metadata: { manifest: 'json' },
    init: function (...args) {
      UIComponent.prototype.init.call(this, ...args);
    }
  });
});

/*---------------------------------*
 * File: app/controller/App.js *
 *---------------------------------*/
import { setModel, dispatch } from '../store';

var Controller;
sap.ui.define('app/controller/App', ['sap/ui/core/mvc/Controller'], function (_Controller) {
  Controller = _Controller
  return Controller.extend('app.controller.AppController', {
    onInit: function () {
      setModel(this);
    },
    onHelloWorldClick: function () {
      dispatch('exampleButtonClick');
    }
  });
});

/*---------------------------------*
 * File: app/store/index.js *
 *---------------------------------*/
import * as actions from './actions';
var JSONModel;
sap.ui.define('app/store/index', ['sap/ui/model/json/JSONModel'], function (_JSONModel) {
  JSONModel = _JSONModel
});

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
  ...
}
```


