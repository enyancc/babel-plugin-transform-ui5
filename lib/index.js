'use strict';

var _babelTemplate = require('babel-template');

var _babelTemplate2 = _interopRequireDefault(_babelTemplate);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var buildDefine = (0, _babelTemplate2.default)('\n  VARS;\n  sap.ui.define(MODULE_NAME, [SOURCES], FACTORY);\n');

var buildFactory = (0, _babelTemplate2.default)('\n  (function (PARAMS) {\n    BODY;\n  })\n');

exports.default = function (_ref) {
  var t = _ref.types;

  var ui5ModuleVisitor = {
    Program: {
      enter: function enter(path, state) {
        var filePath = _path2.default.resolve(path.hub.file.opts.filename);
        var sourceRootPath = getSourceRoot(path);

        var relativeFilePath = null;
        var relativeFilePathWithoutExtension = null;
        var namespace = null;
        if (filePath.startsWith(sourceRootPath)) {
          relativeFilePath = _path2.default.relative(sourceRootPath, filePath);
          relativeFilePathWithoutExtension = _path2.default.dirname(relativeFilePath) + _path2.default.sep + _path2.default.basename(relativeFilePath, _path2.default.extname(relativeFilePath));
          relativeFilePathWithoutExtension = relativeFilePathWithoutExtension.replace(/\\/g, '/');

          var parts = relativeFilePath.split(_path2.default.sep);
          if (parts.length <= 1) {
            namespace = relativeFilePath;
          } else {
            parts.pop();
            namespace = parts.join('.');
          }
        }

        if (!path.state) {
          path.state = {};
        }
        path.state.ui5 = {
          filePath: filePath,
          relativeFilePath: relativeFilePath,
          relativeFilePathWithoutExtension: relativeFilePathWithoutExtension,
          namespace: namespace,
          className: null,
          fullClassName: null,
          superClassName: null,
          imports: [],
          staticMembers: [],
          returnValue: false
        };
      },
      exit: function exit(path) {
        var state = path.state.ui5;
        var hasUi5 = state.returnValue || state.imports.length;

        if (hasUi5) {
          var _node$body;

          var node = path.node;

          var factoryBody = state.imports.map(function (i) {
            if (i.isLib) {
              i.path.remove();
            }

            return t.assignmentExpression('=', t.identifier(i.name), i.tmpName);
          });

          if (state.returnValue) {
            factoryBody.push(t.returnStatement(state.returnValue));
          }

          var factory = buildFactory({
            PARAMS: state.imports.map(function (i) {
              return i.tmpName;
            }),
            BODY: factoryBody
          });

          var factoryInsertIndex = 0;

          for (var i = 0, target = node.body; i < target.length; i++) {
            if (target[i].type !== 'ImportDeclaration') {
              factoryInsertIndex = i + 1;
              break;
            }
          }

          var define = buildDefine({
            VARS: state.imports.map(function (i) {
              return t.identifier(i.name);
            }).map(function (i) {
              return t.variableDeclaration('var', [t.variableDeclarator(i)]);
            }),
            MODULE_NAME: t.stringLiteral(state.relativeFilePathWithoutExtension),
            SOURCES: state.imports.map(function (i) {
              return t.stringLiteral(i.src);
            }),
            FACTORY: factory
          });
          (_node$body = node.body).splice.apply(_node$body, [factoryInsertIndex, 0].concat(_toConsumableArray(define)));
        }
      }
    },

    ImportDeclaration: function ImportDeclaration(path, _ref2) {
      var opts = _ref2.opts;

      var state = path.state.ui5;
      var node = path.node;
      var sourceRootPath = getSourceRoot(path);
      var name = null;

      var srcRaw = node.source.value;
      var srcPath = null;
      if (srcRaw.startsWith('./') || srcRaw.startsWith('../')) {
        srcPath = _path2.default.normalize(_path2.default.resolve(_path2.default.dirname(state.filePath), srcRaw));
        srcRaw = _path2.default.relative(sourceRootPath, srcPath);
      }
      var srcNormalized = _path2.default.normalize(srcRaw);
      var src = srcNormalized.replace(/\\/g, '/');

      if (node.specifiers && node.specifiers.length === 1) {
        name = node.specifiers[0].local.name;
      } else {
        var parts = srcNormalized.split(_path2.default.sep);
        name = parts[parts.length - 1];
      }

      if (node.leadingComments) {
        state.leadingComments = node.leadingComments;
      }

      var testLibs = opts.libs || ['^sap/'];
      var isLibRE = testLibs.length && new RegExp('(' + testLibs.join('|') + ')');
      var isLib = isLibRE.test(src);
      var testSrc = (opts.libs || ['^sap/']).concat(opts.files || []);
      var isUi5SrcRE = testSrc.length && new RegExp('(' + testSrc.join('|') + ')');
      var isUi5Src = isUi5SrcRE.test(src);

      if (isLib || isUi5Src) {
        var tmpName = path.scope.generateUidIdentifierBasedOnNode(t.identifier(name));
        var imp = {
          path: path,
          name: name,
          tmpName: tmpName,
          isLib: isLib,
          isUi5Src: isUi5Src,
          src: src
        };

        state.imports.push(imp);
      }
    },

    ExportDeclaration: function ExportDeclaration(path) {
      var state = path.state.ui5;

      var id = path.node.declaration.id;
      var leadingComments = path.node.leadingComments;

      if (path.node.declaration.type === 'ClassDeclaration') {
        state.returnValue = transformClass(path.node.declaration, state);
        path.remove();
      }

      return;

      var defineCallArgs = [t.stringLiteral(state.relativeFilePathWithoutExtension), t.arrayExpression(state.imports.map(function (i) {
        return t.stringLiteral(i.src);
      })), t.functionExpression(null, state.imports.map(function (i) {
        return t.identifier(i.name);
      }), t.blockStatement([t.expressionStatement(t.stringLiteral('use strict')), t.returnStatement(transformClass(path.node.declaration, program, state))]))];
      var defineCall = t.callExpression(t.identifier('sap.ui.define'), defineCallArgs);
      if (state.leadingComments) {
        defineCall.leadingComments = state.leadingComments;
      }
      path.replaceWith(defineCall);

      // Add static members
      for (var key in state.staticMembers) {
        var _id = t.identifier(state.fullClassName + '.' + key);
        var statement = t.expressionStatement(t.assignmentExpression('=', _id, state.staticMembers[key]));
        path.insertAfter(statement);
      }
    },

    CallExpression: function CallExpression(path) {
      var state = path.state.ui5;
      var node = path.node;

      if (node.callee.type === 'Super') {
        if (!state.superClassName) {
          this.errorWithNode("The keyword 'super' can only used in a derrived class.");
        }

        var identifier = t.identifier(state.superClassName + '.apply');
        var args = t.arrayExpression(node.arguments);
        if (node.arguments.length === 1 && node.arguments[0].type === 'Identifier' && node.arguments[0].name === 'arguments') {
          args = t.identifier('arguments');
        }
        path.replaceWith(t.callExpression(identifier, [t.identifier('this'), args]));
      } else if (node.callee.object && node.callee.object.type === 'Super') {
        if (!state.superClassName) {
          this.errorWithNode("The keyword 'super' can only used in a derrived class.");
        }

        var _identifier = t.identifier(state.superClassName + '.prototype' + '.' + node.callee.property.name + '.apply');
        path.replaceWith(t.callExpression(_identifier, [t.identifier('this'), t.arrayExpression(node.arguments)]));
      }
    }
  };

  function transformClass(node, state) {
    if (node.type !== 'ClassDeclaration') {
      return node;
    } else {
      resolveClass(node, state);

      var props = [];
      node.body.body.forEach(function (member) {
        if (member.type === 'ClassMethod') {
          var func = t.functionExpression(null, member.params, member.body);
          if (!member.static) {
            func.generator = member.generator;
            func.async = member.async;
            props.push(t.objectProperty(member.key, func));
          } else {
            func.body.body.unshift(t.expressionStatement(t.stringLiteral('use strict')));
            state.staticMembers[member.key.name] = func;
          }
        } else if (member.type == 'ClassProperty') {
          if (!member.static) {
            props.push(t.objectProperty(member.key, member.value));
          } else {
            state.staticMembers[member.key.name] = member.value;
          }
        }
      });

      var bodyJSON = t.objectExpression(props);
      var extendCallArgs = [t.stringLiteral(state.fullClassName), bodyJSON];
      var extendCall = t.callExpression(t.identifier(state.superClassName + '.extend'), extendCallArgs);
      return extendCall;
    }
  }

  function resolveClass(node, state) {
    state.className = node.id.name;
    state.superClassName = node.superClass.name;
    if (state.namespace) {
      state.fullClassName = state.namespace + '.' + state.className;
    } else {
      state.fullClassName = state.className;
    }
  }

  function getSourceRoot(path) {
    var sourceRootPath = null;
    if (path.hub.file.opts.sourceRoot) {
      sourceRootPath = _path2.default.resolve(path.hub.file.opts.sourceRoot);
    } else {
      sourceRootPath = _path2.default.resolve('.' + _path2.default.sep);
    }
    return sourceRootPath;
  }

  return {
    name: 'transform-ui5',
    visitor: ui5ModuleVisitor
  };
};

module.exports = exports.default;
