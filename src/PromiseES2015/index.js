Promise.prototype.catch = function(onRejected) {
  return this.then(null, onRejected);
}

Promise.resolve = value => new Promise(resolve => resolve(value));

Promise.reject = reason => new Promise((_, reject) => reject(reason));
