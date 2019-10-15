const isFunction = obj => typeof obj === 'function';
const isObject = obj => !!(obj && typeof obj === 'object');
const isThenable = obj => (isFunction(obj) || isObject(obj)) && 'then' in obj;
const isPromise = promise => promise instanceof Promise;

const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

function Promise(f) {
  this.state = PENDING;
  this.result = null;
  this.callbacks = [];

  const onFulfilled = value => transition(this, FULFILLED, value);
  const onRejected = reason => transition(this, REJECTED, reason);

  // 保证 resolve/reject 只有一次调用作用
  let flag = false;
  const resolve = value => {
    if (flag) {
      return;
    }
    flag = true;
    resolvePromise(this, value, onFulfilled, onRejected);
  }
  const resolve = reason => {
    if (flag) {
      return;
    }
    flag = true;
    onRejected(reason);
  }

  try {
    f(resolve, reject);
  } catch (error) {
    reject(error);
  }
}

const transition = (promise, state, result) => {
  if (promise.state !== PENDING) {
    return;
  }
  promise.state = state;
  promise.result = result;
  setTimeout(() => handleCallbacks(promise.callbacks, state, result), 0);
}

Promise.prototype.then = function (onFulfilled, onRejected) {
  return new Promise((resolve, reject) => {
    const callback = { onFulfilled, onRejected, resolve, reject };

    if (this.state === PENDING) {
      this.callbacks.push(callback);
    } else {
      setTimeout(() => handleCallback(callback, this.state, this.result), 0);
    }
  });
}

const handleCallback = (callback, state, result) => {
  const { onFulfilled, onRejected, resolve, reject } = callback;
  try {
    if (state === FULFILLED) {
      isFunction(onFulfilled) ? resolve(onFulfilled(result)) : resolve(result);
    } else if (state === REJECTED) {
      isFunction(onRejected) ? resolve(onRejected(result)) : reject(result);
    }
  } catch (error) {
    reject(error);
  }
}

const resolvePromise = (promise, result, resolve, reject) => {
  if (result === promise) {
    const reason = new TypeError('promise 不能是本身');
    return reject(reason);
  }

  if (isPromise(result)) {
    return result.then(resolve, reject);
  }

  if (isThenable(result)) {
    try {
      const then = result.then;
      if (isFunction(then)) {
        return new Promise(then.bind(result)).then(resolve, reject);
      }
    } catch (error) {
      return reject(error);
    }
  }

  resolve(result);
}