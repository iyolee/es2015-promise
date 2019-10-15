# Promise
Promise 对象是 JavaScript 的异步操作解决方案。基于[Promises/A+ 规范](https://promisesaplus.com/)实现 ES2015 规范中的 Promise。

### 三种状态
Promise 对象通过自身的状态，来控制异步操作。Promise 实例具有三种状态。

>异步操作未完成（pending）
异步操作成功（fulfilled）
异步操作失败（rejected）

``` js
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected'
```

### 构造函数
声明 Promise 构造函数，该函数有 state 和result 两个属性。

1. 若 state == fulfilled，则 result == value；
2. 若 state == rejected，则 result == reason。

```js
function Promise() {
  this.state = PENDING;
  this.result = null;
  // 顺序调用onFulfilled 和 onRejected 的 callback
  this.callbacks = [];
}
```

### 状态迁移
这三种的状态的变化途径只有两种。

>从“未完成”到“成功”
从“未完成”到“失败”

``` js
const transition = (promise, state, result) => {
  if (promise.state !== PENDING) {
    return;
  }
  promise.state = state;
  promise.result = result;
}
```

### Then 方法
Promise 实例的 then 方法，用来添加回调函数。

then方法可以接受两个回调函数，第一个是异步操作成功时（变为fulfilled状态）时的回调函数，第二个是异步操作失败（变为rejected）时的回调函数（该参数可以省略）。一旦状态改变，就调用相应的回调函数。

``` js
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
```

由于不是在 JavaScript 引擎层面实现 Promise，而是使用 JavaScript 去实现 JavaScript Promise。无法主动控制自身 execution context stack。可以通过 setTimeout/nextTick 等 API 间接实现。  
  
handleCallback 函数用于根据 state 来判断是使用 fulfilled 来处理还是 rejected 来处理。然后，再判断 onFulfilled/onRejected 是否是函数，若是，则以返回值作为下一个 Promise 的result；若不是，则将当前的 Promise 的 result 作为下一个 Promise 的 result。

``` js
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
```

### The Promise Resolution Procedure
一些特殊的 value 被 resolve 时，需要做特殊处理：
1. 如果 result 是当前 promise 本身，就抛出 TypeError 错误；
2. 如果 result 是另一个 promise，那么沿用它的 state 和 result 状态；
3. 如果 result 是一个 thenable 对象。先取 then 函数，再调用 then 函数，重新进入 The Promise Resolution Procedure 过程;
4. 如果不是上述情况，这个 result 成为当前 promise 的 result。

``` js
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
```

### 整合
- transition 对单个 promise 进行状态转移；
- handleCallback 对当前 promise 和下一个 promise 之间进行状态传递；
- resolvePromise 用于对特殊的 result 进行特殊处理。

至此，符合 Promises/A+ 规范全部代码如下：
``` js
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
  const reject = reason => {
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
```