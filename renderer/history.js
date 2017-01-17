const deepEqual = require('deep-equal')

module.exports = function () {
  var history = []
  var currentPosition = null
  var listeners = []

  function cut () {
    if (currentPosition !== null) {
      history = history.slice(0, currentPosition + 1)
    }
  }

  function push (item) {
    if (deepEqual(item, current())) {
      return current()
    }

    cut()
    history.push(item)

    if (currentPosition === null) {
      currentPosition = 0
    } else {
      currentPosition += 1
    }

    process.nextTick(notifyListeners)
    return current()
  }

  function canGoBack (steps) {
    if (typeof steps === 'undefined') {
      steps = 1
    }

    return currentPosition - steps >= 0
  }

  function canGoForward (steps) {
    if (typeof steps === 'undefined') {
      steps = 1
    }

    return currentPosition + steps <= history.length - 1
  }

  function back (steps) {
    if (typeof steps === 'undefined') {
      steps = 1
    }

    if (canGoBack(steps)) {
      currentPosition -= steps
    } else {
      currentPosition = 0
    }

    process.nextTick(notifyListeners)
    return current()
  }

  function forward (steps) {
    if (typeof steps === 'undefined') {
      steps = 1
    }

    if (canGoForward(steps)) {
      currentPosition += steps
    } else {
      currentPosition = history.length - 1
    }

    process.nextTick(notifyListeners)
    return current()
  }

  function current () {
    if (!history.length) {
      return null
    }

    return history[currentPosition]
  }

  function subscribe (listener) {
    listeners.push(listener)
    var isSubscribed = true

    return function unsubscribe () {
      if (!isSubscribed) {
        return
      }

      isSubscribed = false
      var index = listeners.indexOf(listener)
      listeners.splice(index, 1)
    }
  }

  function notifyListeners () {
    listeners.slice().forEach(function (listener) {
      listener()
    })
  }

  return {
    push: push,
    canGoBack: canGoBack,
    canGoForward: canGoForward,
    back: back,
    forward: forward,
    current: current,
    subscribe: subscribe
  }
}
