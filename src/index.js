import template from 'babel-template';
import Path from 'path';

const buildDefine = template(`
  VARS;
  sap.ui.define(MODULE_NAME, [SOURCES], FACTORY);
`);

const buildFactory = template(`
  (function (PARAMS) {
    BODY;
  })
`);

exports.default = function({ types: t }) {
  const ui5ModuleVisitor = {
    Program: {
      enter: (path, state) => {
        const filePath = Path.resolve(path.hub.file.opts.filename);
        const sourceRootPath = getSourceRoot(path);

        let relativeFilePath = null;
        let relativeFilePathWithoutExtension = null;
        let namespace = null;
        if (filePath.startsWith(sourceRootPath)) {
          relativeFilePath = Path.relative(sourceRootPath, filePath);
          relativeFilePathWithoutExtension =
            Path.dirname(relativeFilePath) + Path.sep + Path.basename(relativeFilePath, Path.extname(relativeFilePath));
          relativeFilePathWithoutExtension = relativeFilePathWithoutExtension.replace(/\\/g, '/');

          const parts = relativeFilePath.split(Path.sep);
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
          filePath,
          relativeFilePath,
          relativeFilePathWithoutExtension,
          namespace,
          className: null,
          fullClassName: null,
          superClassName: null,
          imports: [],
          staticMembers: [],
          returnValue: false
        };
      },
      exit(path) {
        const state = path.state.ui5;
        const hasUi5 = state.returnValue || state.imports.length;

        if (hasUi5) {
          const { node } = path;
          const factoryBody = state.imports.map(i => {
            if (i.isLib) {
              i.path.remove();
            }

            return t.assignmentExpression('=', t.identifier(i.name), i.tmpName);
          });

          if (state.returnValue) {
            factoryBody.push(t.returnStatement(state.returnValue));
          }

          const factory = buildFactory({
            PARAMS: state.imports.map(i => i.tmpName),
            BODY: factoryBody
          });

          let factoryInsertIndex = 0;

          for (let i = 0, target = node.body; i < target.length; i++) {
            if (target[i].type !== 'ImportDeclaration') {
              factoryInsertIndex = i + 1;
              break;
            }
          }

          const define = buildDefine({
            VARS: state.imports
              .map(i => t.identifier(i.name))
              .map(i => t.variableDeclaration('var', [t.variableDeclarator(i)])),
            MODULE_NAME: t.stringLiteral(state.relativeFilePathWithoutExtension),
            SOURCES: state.imports.map(i => t.stringLiteral(i.src)),
            FACTORY: factory
          });
          node.body.splice(factoryInsertIndex, 0, ...define);
        }
      }
    },

    ImportDeclaration: (path, { opts }) => {
      const state = path.state.ui5;
      const node = path.node;
      const sourceRootPath = getSourceRoot(path);
      let name = null;

      let srcRaw = node.source.value;
      let srcPath = null;
      if (srcRaw.startsWith('./') || srcRaw.startsWith('../')) {
        srcPath = Path.normalize(Path.resolve(Path.dirname(state.filePath), srcRaw));
        srcRaw = Path.relative(sourceRootPath, srcPath);
      }
      const srcNormalized = Path.normalize(srcRaw);
      const src = srcNormalized.replace(/\\/g, '/');

      if (node.specifiers && node.specifiers.length === 1) {
        name = node.specifiers[0].local.name;
      } else {
        const parts = srcNormalized.split(Path.sep);
        name = parts[parts.length - 1];
      }

      if (node.leadingComments) {
        state.leadingComments = node.leadingComments;
      }

      const testLibs = opts.libs || ['^sap/'];
      const isLibRE = testLibs.length && new RegExp(`(${testLibs.join('|')})`);
      const isLib = isLibRE.test(src);
      const testSrc = (opts.libs || ['^sap/']).concat(opts.files || []);
      const isUi5SrcRE = testSrc.length && new RegExp(`(${testSrc.join('|')})`);
      const isUi5Src = isUi5SrcRE.test(src);

      if (isLib || isUi5Src) {
        const tmpName = path.scope.generateUidIdentifierBasedOnNode(t.identifier(name));
        const imp = {
          path,
          name,
          tmpName,
          isLib,
          isUi5Src,
          src
        };

        state.imports.push(imp);
      }
    },

    ExportDeclaration: path => {
      const state = path.state.ui5;

      const id = path.node.declaration.id;
      const leadingComments = path.node.leadingComments;

      if (path.node.declaration.type === 'ClassDeclaration') {
        state.returnValue = transformClass(path.node.declaration, state);
        path.remove();
      }

      return;

      const defineCallArgs = [
        t.stringLiteral(state.relativeFilePathWithoutExtension),
        t.arrayExpression(state.imports.map(i => t.stringLiteral(i.src))),
        t.functionExpression(
          null,
          state.imports.map(i => t.identifier(i.name)),
          t.blockStatement([
            t.expressionStatement(t.stringLiteral('use strict')),
            t.returnStatement(transformClass(path.node.declaration, program, state))
          ])
        )
      ];
      const defineCall = t.callExpression(t.identifier('sap.ui.define'), defineCallArgs);
      if (state.leadingComments) {
        defineCall.leadingComments = state.leadingComments;
      }
      path.replaceWith(defineCall);

      // Add static members
      for (let key in state.staticMembers) {
        const id = t.identifier(state.fullClassName + '.' + key);
        const statement = t.expressionStatement(t.assignmentExpression('=', id, state.staticMembers[key]));
        path.insertAfter(statement);
      }
    },

    CallExpression(path) {
      const state = path.state.ui5;
      const node = path.node;

      if (node.callee.type === 'Super') {
        if (!state.superClassName) {
          this.errorWithNode("The keyword 'super' can only used in a derrived class.");
        }

        const identifier = t.identifier(state.superClassName + '.apply');
        let args = t.arrayExpression(node.arguments);
        if (
          node.arguments.length === 1 &&
          node.arguments[0].type === 'Identifier' &&
          node.arguments[0].name === 'arguments'
        ) {
          args = t.identifier('arguments');
        }
        path.replaceWith(t.callExpression(identifier, [t.identifier('this'), args]));
      } else if (node.callee.object && node.callee.object.type === 'Super') {
        if (!state.superClassName) {
          this.errorWithNode("The keyword 'super' can only used in a derrived class.");
        }

        const identifier = t.identifier(
          state.superClassName + '.prototype' + '.' + node.callee.property.name + '.apply'
        );
        path.replaceWith(t.callExpression(identifier, [t.identifier('this'), t.arrayExpression(node.arguments)]));
      }
    }
  };

  function transformClass(node, state) {
    if (node.type !== 'ClassDeclaration') {
      return node;
    } else {
      resolveClass(node, state);

      const props = [];
      node.body.body.forEach(member => {
        if (member.type === 'ClassMethod') {
          const func = t.functionExpression(null, member.params, member.body);
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

      const bodyJSON = t.objectExpression(props);
      const extendCallArgs = [t.stringLiteral(state.fullClassName), bodyJSON];
      const extendCall = t.callExpression(t.identifier(state.superClassName + '.extend'), extendCallArgs);
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
    let sourceRootPath = null;
    if (path.hub.file.opts.sourceRoot) {
      sourceRootPath = Path.resolve(path.hub.file.opts.sourceRoot);
    } else {
      sourceRootPath = Path.resolve('.' + Path.sep);
    }
    return sourceRootPath;
  }

  return {
    name: 'transform-ui5',
    visitor: ui5ModuleVisitor
  };
};

module.exports = exports.default;
