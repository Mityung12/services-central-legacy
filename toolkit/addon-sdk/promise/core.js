/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint undef: true es5: true node: true browser: true devel: true
         forin: true latedef: false */
/*global define: true, Cu: true, __URI__: true */
;(function(id, factory) { // Module boilerplate :(
  if (typeof(define) === 'function') { // RequireJS
    define(factory);
  } else if (typeof(require) === 'function') { // CommonJS
    factory.call(this, require, exports, module);
  } else if (String(this).indexOf('BackstagePass') >= 0) { // JSM
    factory(function require(uri) {
      var imports = {};
      this['Components'].utils.import(uri, imports);
      return imports;
    }, this, { uri: __URI__, id: id });
    this.EXPORTED_SYMBOLS = Object.keys(this);
  } else {  // Browser or alike
    var globals = this;
    factory(function require(id) {
      return globals[id];
    }, (globals[id] = {}), { uri: document.location.href + '#' + id, id: id });
  }
}).call(this, 'promise/core', function(require, exports, module) {

'use strict';

/**
 * Internal utility: Wraps given `value` into simplified promise, successfully
 * fulfilled to a given `value`. Note the result is not a complete promise
 * implementation, as its method `then` does not returns anything.
 */
function fulfilled(value) {
  return { then: function then(fulfill) { fulfill(value); } };
}

/**
 * Internal utility: Wraps given input into simplified promise, pre-rejected
 * with a given `reason`. Note the result is not a complete promise
 * implementation, as its method `then` does not returns anything.
 */
function rejected(reason) {
  return { then: function then(fulfill, reject) { reject(reason); } };
}

/**
 * Internal utility: Decorates given `f` function, so that on exception promise
 * rejected with thrown error is returned.
 */
function attempt(f) {
  return function effort(input) {
    try {
      return f(input);
    }
    catch(error) {
      return rejected(error);
    }
  };
}

/**
 * Internal utility: Returns `true` if given `value` is a promise. Value is
 * assumed to be a promise if it implements method `then`.
 */
function isPromise(value) {
  return value && typeof(value.then) === 'function';
}

/**
 * Creates deferred object containing fresh promise & methods to either resolve
 * or reject it. The result is an object with the following properties:
 * - `promise` Eventual value representation implementing CommonJS [Promises/A]
 *   (http://wiki.commonjs.org/wiki/Promises/A) API.
 * - `resolve` Single shot function that resolves enclosed `promise` with a
 *   given `value`.
 * - `reject` Single shot function that rejects enclosed `promise` with a given
 *   `reason`.
 *
 *  ## Example
 *
 *  function fetchURI(uri, type) {
 *    var deferred = defer();
 *    var request = new XMLHttpRequest();
 *    request.open("GET", uri, true);
 *    request.responseType = type;
 *    request.onload = function onload() {
 *      deferred.resolve(request.response);
 *    }
 *    request.onerror = function(event) {
 *     deferred.reject(event);
 *    }
 *    request.send();
 *
 *    return deferred.promise;
 *  }
 */
function defer() {
  // Define FIFO queue of observer pairs. Once promise is resolved & all queued
  // observers are forwarded to `result` and variable is set to `null`.
  var observers = [];

  // Promise `result`, which will be assigned a resolution value once promise
  // is resolved. Note that result will always be assigned promise (or alike)
  // object to take care of propagation through promise chains. If result is
  // `null` promise is not resolved yet.
  var result = null;

  var deferred = {
    promise: {
      then: function then(onFulfill, onError) {
        var deferred = defer();

        // Decorate `onFulfill` / `onError` handlers with `attempt`, that
        // way if wrapped handler throws exception decorator will catch and
        // return promise rejected with it, which will cause rejection of
        // `deferred.promise`. If handler is missing, substitute it with an
        // utility function that takes one argument and returns promise
        // fulfilled / rejected with it. This takes care of propagation
        // through the rest of the promise chain.
        onFulfill = onFulfill ? attempt(onFulfill) : fulfilled;
        onError = onError ? attempt(onError) : rejected;

        // Create a pair of observers that invoke given handlers & propagate
        // results to `deferred.promise`.
        function resolveDeferred(value) { deferred.resolve(onFulfill(value)); }
        function rejectDeferred(reason) { deferred.resolve(onError(reason)); }

        // If enclosed promise (`this.promise`) observers queue is still alive
        // enqueue a new observer pair into it. Note that this does not
        // necessary means that promise is pending, it may already be resolved,
        // but we still have to queue observers to guarantee an order of
        // propagation.
        if (observers) {
          observers.push({ resolve: resolveDeferred, reject: rejectDeferred });
        }
        // Otherwise just forward observer pair right to a `result` promise.
        else {
          result.then(resolveDeferred, rejectDeferred);
        }

        return deferred.promise;
      }
    },
    /**
     * Resolves associated `promise` to a given `value`, unless it's already
     * resolved or rejected. Note that resolved promise is not necessary a
     * successfully fulfilled. Promise may be resolved with a promise `value`
     * in which case `value` promise's fulfillment / rejection will propagate
     * up to a promise resolved with `value`.
     */
    resolve: function resolve(value) {
      if (!result) {
        // Store resolution `value` in a `result` as a promise, so that all
        // the subsequent handlers can be simply forwarded to it. Since
        // `result` will be a promise all the value / error propagation will
        // be uniformly taken care of.
        result = isPromise(value) ? value : fulfilled(value);

        // Forward already registered observers to a `result` promise in the
        // order they were registered. Note that we intentionally dequeue
        // observer at a time until queue is exhausted. This makes sure that
        // handlers registered as side effect of observer forwarding are
        // queued instead of being invoked immediately, guaranteeing FIFO
        // order.
        while (observers.length) {
          var observer = observers.shift();
          result.then(observer.resolve, observer.reject);
        }

        // Once `observers` queue is exhausted we `null`-ify it, so that
        // new handlers are forwarded straight to the `result`.
        observers = null;
      }
    },
    /**
     * Rejects associated `promise` with a given `reason`, unless it's already
     * resolved / rejected. This is just a (better performing) convenience
     * shortcut for `deferred.resolve(reject(reason))`.
     */
    reject: function reject(reason) {
      // Note that if promise is resolved that does not necessary means that it
      // is successfully fulfilled. Resolution value may be a promise in which
      // case its result propagates. In other words if promise `a` is resolved
      // with promise `b`, `a` is either fulfilled or rejected depending
      // on weather `b` is fulfilled or rejected. Here `deferred.promise` is
      // resolved with a promise pre-rejected with a given `reason`, there for
      // `deferred.promise` is rejected with a given `reason`. This may feel
      // little awkward first, but doing it this way greatly simplifies
      // propagation through promise chains.
      deferred.resolve(rejected(reason));
    }
  };

  return deferred;
}
exports.defer = defer;

/**
 * Returns a promise resolved to a given `value`.
 */
function resolve(value) {
  var deferred = defer();
  deferred.resolve(value);
  return deferred.promise;
}
exports.resolve = resolve;

/**
 * Returns a promise rejected with a given `reason`.
 */
function reject(reason) {
  var deferred = defer();
  deferred.reject(reason);
  return deferred.promise;
}
exports.reject = reject;

});
