/*
parseQuery(query) => expression

Transform a query:
{
  "movies=>actionMovies": {
    "()": {"genre": "action"},
    "reverse=>": [
      {
        "title": true,
        "year": true
      }
    ]
  }
}

Into an expression that is easier to execute by the runtime:
{
  "sourceKey": "",
  "nestedExpressions": {
    "actionMovies": {
      "sourceKey": "movies",
      "params": {"genre": "action"},
      "nextExpression": {
        "sourceKey": "reverse",
        "useCollectionElements": true,
        "nestedExpressions": {
          "title": {
            "sourceKey": "title"
          },
          "year": {
            "sourceKey": "year"
          }
        }
      }
    }
  }
}
*/

export function parseQuery(
  query,
  {ignoreKeys = [], acceptKeys = [], ignoreBuiltInKeys = true} = {}
) {
  if (query === undefined) {
    throw new Error(`'query' parameter is missing`);
  }

  if (!Array.isArray(ignoreKeys)) {
    ignoreKeys = [ignoreKeys];
  }

  if (!Array.isArray(acceptKeys)) {
    acceptKeys = [acceptKeys];
  }

  return _parseQuery(query, {}, {ignoreKeys, acceptKeys, ignoreBuiltInKeys});
}

function _parseQuery(
  query,
  {sourceKey = '', isOptional},
  {ignoreKeys, acceptKeys, ignoreBuiltInKeys}
) {
  if (query === undefined) {
    throw new Error(`'query' parameter is missing`);
  }

  const expression = {sourceKey, isOptional};

  if (Array.isArray(query)) {
    if (query.length !== 1) {
      throw new Error('An array should contain exactly one item');
    }
    expression.useCollectionElements = true;
    query = query[0];
  }

  if (query === true) {
    return expression;
  }

  if (typeof query !== 'object' || query === null) {
    throw new Error(`Invalid query found: ${JSON.stringify(query)}`);
  }

  let nestedExpressions;
  let nextExpression;

  for (const [key, value] of Object.entries(query)) {
    if (key === '()') {
      expression.params = value;
      continue;
    }

    const {sourceKey, targetKey, isOptional} = parseKey(key);

    if (ignoreBuiltInKeys && getBuiltInKeys().includes(sourceKey)) {
      continue;
    }

    if (testKey(sourceKey, ignoreKeys) && !testKey(sourceKey, acceptKeys)) {
      continue;
    }

    const subexpression = _parseQuery(
      value,
      {sourceKey, isOptional},
      {ignoreKeys, acceptKeys, ignoreBuiltInKeys}
    );

    if (targetKey) {
      if (nestedExpressions === undefined) {
        nestedExpressions = {};
      }
      nestedExpressions[targetKey] = subexpression;
    } else {
      if (nextExpression) {
        throw new Error('Multiple empty targets found at the same level');
      }
      nextExpression = subexpression;
    }
  }

  if (nextExpression !== undefined) {
    if (nestedExpressions) {
      throw new Error('Empty and non-empty targets found at the same level');
    }
    expression.nextExpression = nextExpression;
  }

  if (nestedExpressions !== undefined) {
    expression.nestedExpressions = nestedExpressions;
  }

  return expression;
}

function parseKey(key) {
  let sourceKey;
  let targetKey;
  let isOptional;

  const parts = key.split('=>');

  if (parts.length === 1) {
    sourceKey = parts[0];
    ({sourceKey, isOptional} = parseSourceKey(sourceKey));
    targetKey = sourceKey;
  } else if (parts.length === 2) {
    sourceKey = parts[0];
    ({sourceKey, isOptional} = parseSourceKey(sourceKey));
    targetKey = parts[1];
  } else {
    throw new Error(`Invalid key found: '${key}'`);
  }

  return {sourceKey, targetKey, isOptional};
}

function parseSourceKey(sourceKey) {
  let isOptional;
  if (sourceKey.endsWith('?')) {
    isOptional = true;
    sourceKey = sourceKey.slice(0, -1);
  }
  return {sourceKey, isOptional};
}

function testKey(key, patterns) {
  return patterns.some(pattern =>
    typeof pattern === 'string' ? pattern === key : pattern.test(key)
  );
}

let _builtInKeys;
function getBuiltInKeys() {
  if (!_builtInKeys) {
    _builtInKeys = [];
    class Obj {}
    const obj = new Obj();
    const func = function () {};
    _addKeys(_builtInKeys, obj);
    _addKeys(_builtInKeys, func);
    _addKeys(_builtInKeys, Obj);
  }
  return _builtInKeys;
}

function _addKeys(array, object) {
  while (object) {
    for (const key of Object.getOwnPropertyNames(object)) {
      if (!(key === 'name' || key === 'length' || array.indexOf(key) !== -1)) {
        array.push(key);
      }
    }
    object = Object.getPrototypeOf(object);
  }
}
