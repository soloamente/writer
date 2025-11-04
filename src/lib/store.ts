/**
 * React Hook Getter Pattern - Inspired by SWR and Zustand
 * 
 * This pattern uses JavaScript Proxy to detect property access and only
 * re-renders components when the properties they actually use change.
 * 
 * @example
 * ```ts
 * const useStore = createStore({
 *   name: 'John',
 *   username: 'johndoe',
 * })
 * 
 * function NameDisplay() {
 *   const state = useStore()
 *   // Only re-renders when state.name changes, not when state.username changes
 *   return <input value={state.name} onChange={(e) => (state.name = e.target.value)} />
 * }
 * ```
 */

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";

// Use useLayoutEffect on client, useEffect on server
const useLayout =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Store instance with state and methods
 */
export interface StoreInstance<T extends Record<string, unknown>> {
  state: T;
  setState: <K extends keyof T>(key: K, value: T[K]) => void;
  subscribe: (listener: (changedKey: keyof T) => void) => () => void;
}

/**
 * Creates a store with reactive state management using Proxy getters
 * 
 * @param initial - Initial state object
 * @returns A hook that returns a Proxy to the state, and optionally a store instance
 */
export function createStore<T extends Record<string, unknown>>(
  initial: T,
): (() => T) & { getState: () => T; setState: <K extends keyof T>(key: K, value: T[K]) => void; subscribe: (listener: (changedKey: keyof T) => void) => () => void } {
  // Keep state outside render lifecycle
  const state = { ...initial };

  // Track all listeners (components using this store)
  const listeners = new Set<(changedKey: keyof T) => void>();

  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   */
  function subscribe(listener: (changedKey: keyof T) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  /**
   * Update state and notify listeners
   */
  function setState<K extends keyof T>(key: K, value: T[K]) {
    // Only update and notify if value actually changed
    if (!Object.is(state[key], value)) {
      state[key] = value;
      // Notify all listeners about the changed key
      listeners.forEach((listener) => listener(key));
    }
  }

  /**
   * Get current state (for use outside React)
   */
  function getState(): T {
    return state;
  }

  /**
   * Hook to use the store
   * Returns a Proxy that tracks property access and triggers re-renders
   */
  function useStore() {
    // Force re-render function
    const [, rerender] = useState({});

    // Track which properties this component has accessed
    const tracked = useRef<Partial<Record<keyof T, boolean>>>({});

    // Keep reference to current state
    const stateRef = useRef(state);

    // Create Proxy that tracks property access
    const proxy = useMemo(() => {
      stateRef.current = state;
      return new Proxy({} as T, {
        get(_, property: keyof T) {
          // Mark this property as tracked by this component
          tracked.current[property] = true;
          // Return current value
          return stateRef.current[property];
        },
        set(_, property: keyof T, value: T[keyof T]) {
          // Update state when property is set
          setState(property, value);
          return true;
        },
      });
    }, []);

    // Subscribe to state changes
    useLayout(() => {
      // Update stateRef when state changes externally
      stateRef.current = state;

      const unsubscribe = subscribe((changedKey) => {
        // Only re-render if this component tracks the changed property
        if (tracked.current[changedKey]) {
          // Reset tracked to allow re-tracking on next render
          tracked.current = {};
          rerender({});
        }
      });

      return unsubscribe;
    }, []);

    return proxy;
  }

  // Attach getState, setState, and subscribe to the hook function
  (useStore as unknown as { getState: () => T; setState: typeof setState; subscribe: typeof subscribe }).getState = getState;
  (useStore as unknown as { getState: () => T; setState: typeof setState; subscribe: typeof subscribe }).setState = setState;
  (useStore as unknown as { getState: () => T; setState: typeof setState; subscribe: typeof subscribe }).subscribe = subscribe;

  return useStore as (() => T) & { getState: () => T; setState: typeof setState; subscribe: typeof subscribe };
}

