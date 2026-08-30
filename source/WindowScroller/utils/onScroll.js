// @flow
'no babel-plugin-flow-react-proptypes';

import {
  requestAnimationTimeout,
  cancelAnimationTimeout,
} from '../../utils/requestAnimationTimeout';
import type WindowScroller from '../WindowScroller.js';

// Hit testing is suppressed while the window scrolls by adding a class to the
// document element, rather than by writing pointer-events onto body's inline
// style. Modal and focus-trap libraries take ownership of that inline property
// for as long as a dialog is open, saving its previous value and restoring it
// on close. Writing the same property here made the two save/restore cycles
// interleave rather than nest: a dialog opening part way through a scroll
// recorded this transient 'none' as the page's resting value and put it back
// when it closed, leaving the document permanently unable to receive a
// pointer event. A class holds no value for anyone else to read back, and an
// inline style outranks it in the cascade, so the two can coexist.
const SCROLLING_CLASS_NAME = 'ReactVirtualized__scrolling';

let mountedInstances = [];
let disablePointerEventsTimeoutId = null;

function enablePointerEventsIfDisabled() {
  if (disablePointerEventsTimeoutId) {
    disablePointerEventsTimeoutId = null;

    if (document.documentElement) {
      document.documentElement.classList.remove(SCROLLING_CLASS_NAME);
    }
  }
}

function enablePointerEventsAfterDelayCallback() {
  enablePointerEventsIfDisabled();
  mountedInstances.forEach(instance => instance.__resetIsScrolling());
}

function enablePointerEventsAfterDelay() {
  if (disablePointerEventsTimeoutId) {
    cancelAnimationTimeout(disablePointerEventsTimeoutId);
  }

  var maximumTimeout = 0;
  mountedInstances.forEach(instance => {
    maximumTimeout = Math.max(
      maximumTimeout,
      instance.props.scrollingResetTimeInterval,
    );
  });

  disablePointerEventsTimeoutId = requestAnimationTimeout(
    enablePointerEventsAfterDelayCallback,
    maximumTimeout,
  );
}

function onScrollWindow(event: Event) {
  if (event.currentTarget === window && document.documentElement) {
    // Idempotent, so unlike the inline style this needs no guard against
    // several WindowScrollers racing to record the value first.
    document.documentElement.classList.add(SCROLLING_CLASS_NAME);
  }
  enablePointerEventsAfterDelay();
  mountedInstances.forEach(instance => {
    if (instance.props.scrollElement === event.currentTarget) {
      instance.__handleWindowScrollEvent();
    }
  });
}

export function registerScrollListener(
  component: WindowScroller,
  element: Element,
) {
  if (
    !mountedInstances.some(instance => instance.props.scrollElement === element)
  ) {
    element.addEventListener('scroll', onScrollWindow);
  }
  mountedInstances.push(component);
}

export function unregisterScrollListener(
  component: WindowScroller,
  element: Element,
) {
  mountedInstances = mountedInstances.filter(
    instance => instance !== component,
  );
  if (!mountedInstances.length) {
    element.removeEventListener('scroll', onScrollWindow);
    if (disablePointerEventsTimeoutId) {
      cancelAnimationTimeout(disablePointerEventsTimeoutId);
      enablePointerEventsIfDisabled();
    }
  }
}
