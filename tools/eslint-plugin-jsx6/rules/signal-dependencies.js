module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'ensure signals used in $S and $F are listed as dependencies',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      missingDependency: 'Signal "{{name}}" is used in the callback but not listed as a dependency.',
    },
  },
  create(context) {
    /**
     * Finds all identifiers or member expressions starting with $ that are not locally defined.
     */
    function findUsedSignals(node, signals, callbackParams) {
      if (!node) return;

      if (node.type === 'Identifier' && node.name.startsWith('$')) {
        if (!callbackParams.has(node.name)) {
          signals.add(node.name);
        }
      }

      if (node.type === 'MemberExpression') {
        let parts = [];
        let current = node;
        while (current && current.type === 'MemberExpression' && current.property.type === 'Identifier') {
          parts.unshift(current.property.name);
          current = current.object;
        }

        if (current && current.type === 'Identifier' && current.name.startsWith('$')) {
          if (!callbackParams.has(current.name)) {
            let fullName = current.name;
            signals.add(fullName); // Track the bucket itself
            for (const part of parts) {
              fullName += '.' + part;
              signals.add(fullName); // Track each level of the chain
            }
          }
        }
      }

      for (const key in node) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(c => findUsedSignals(c, signals, callbackParams));
        } else if (child && typeof child === 'object' && child.type) {
          findUsedSignals(child, signals, callbackParams);
        }
      }
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === 'Identifier' && (callee.name === '$S' || callee.name === '$F')) {
          if (node.arguments.length < 1) return;

          const callback = node.arguments[0];
          const deps = node.arguments.slice(1);

          const callbackParams = new Set();
          if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
            callback.params.forEach(p => {
              if (p.type === 'Identifier') callbackParams.add(p.name);
            });
          }

          const usedSignals = new Set();
          findUsedSignals(callback, usedSignals, callbackParams);

          const depNames = new Set();
          deps.forEach(dep => {
            if (dep.type === 'Identifier') {
              depNames.add(dep.name);
            } else if (dep.type === 'MemberExpression') {
              let fullName = '';
              let curr = dep;
              let valid = true;
              while (curr) {
                if (curr.type === 'MemberExpression' && curr.property.type === 'Identifier') {
                  fullName = '.' + curr.property.name + fullName;
                  curr = curr.object;
                } else if (curr.type === 'Identifier') {
                  fullName = curr.name + fullName;
                  curr = null;
                } else {
                  valid = false;
                  break;
                }
              }
              if (valid) depNames.add(fullName);
            }
          });

          const missingSignals = new Set();
          
          // Group signals by their root and full path
          const signalGroups = new Map();
          usedSignals.forEach(fullPath => {
            const root = fullPath.split('.')[0];
            if (!signalGroups.has(root)) signalGroups.set(root, []);
            signalGroups.get(root).push(fullPath);
          });

          signalGroups.forEach((paths, root) => {
            // If any path in this group is in deps, it's covered
            const isCovered = paths.some(path => depNames.has(path));
            if (!isCovered) {
              // Report the most specific path for clarity
              const specificPath = paths[paths.length - 1];
              context.report({
                node: callee,
                messageId: 'missingDependency',
                data: { name: specificPath },
              });
            }
          });
        }
      },
    };
  },
};
