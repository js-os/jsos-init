var util = require('util');

/**
 * Replace the ${ENV} values with the corresponding env variables.
 *
 * See https://github.com/npm/npmconf/blob/master/npmconf.js
 */
function envReplace(str) {
  var re = /(\\*)\$\{([^}]+)\}/g,
      error;

  if (typeof str !== 'string') {
    return str;
  }

  return str.replace(re, function (orig, esc, key, i, s) {
    var value,
        key;

    esc = esc.length && esc.length % 2;
    if (esc) {
      return orig;
    }

    value = process.env[key];
    if (undefined === value) {
      error = util.format('Failed to replace env in config: %s', key);
      throw new Error(error);
    }

    return value;
  })
}

/**
 * Walk through the whole object, including its nested properties
 * in the same way as Array.forEach. Note that it does not function for
 * objects having loops and will eventually fail in stack overflow.
 */
function mapNested(obj, fun) {
  var key,
      value,
      newObj = {},
      newObjValue;

  for (key in obj) {
    if (!obj.hasOwnProperty(key)) {
      continue;
    }

    value = obj[key];

    if (typeof value === 'object') {
      // Arrays get recognised as object
      if (Array.isArray(value)) {
        newObjValue = value.map(fun);
      }
      else {
        newObjValue = mapNested(value, fun);
      }
    }
    else {
      newObjValue = value = fun(value);
    }

    newObj[key] = newObjValue;
  }

  return newObj;
}

exports = module.exports = {
  envReplace: envReplace,
  mapNested: mapNested
};
