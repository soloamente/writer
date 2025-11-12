/**
 * React Context version of the Hook Getter Pattern
 * 
 * Allows scoped state management without creating global stores.
 * Useful when you want state that's scoped to a component tree.
 * 
 * @example
 * ```tsx
 * import { Provider, useContext } from '@/lib/store-context'
 * 
 * function Form() {
 *   return (
 *     <Provider value={{ name: 'John', username: 'johndoe' }}>
 *       <NameDisplay />
 *     </Provider>
 *   )
 * }
 * 
 * function NameDisplay() {
 *   const state = useContext()
 *   // Only re-renders when state.name changes
 *   return <input value={state.name} onChange={(e) => (state.name = e.target.value)} />
 * }
 * ```
 */

"use client";

import * as React from "react";

interface StoreContextValue<T extends Record<string, unknown>> {
  state: T;
  subscribe: (listener: (key: keyof T) => void) => () => void;
}

const StoreContext = React.createContext<StoreContextValue<Record<string, unknown>> | null>(null);

/**
 * Hook to access the store from context
 * Only re-renders when accessed properties change
 */
export function useContext<T extends Record<string, unknown>>() {
  const rerender = React.useState({})[1];
  const tracked = React.useRef<Partial<Record<keyof T, boolean>>>({});
  const context = React.useContext(StoreContext);

  if (!context) {
    throw new Error("useContext must be used within a Provider");
  }

  const { state, subscribe } = context as StoreContextValue<T>;

  const proxy = React.useRef(
    new Proxy({} as T, {
      get(_, key: string | symbol) {
        // Mark this property as tracked
        if (typeof key === "string" && key in state) {
          tracked.current[key as keyof T] = true;
          return state[key as keyof T];
        }
        return undefined;
      },
      set(_, key: string | symbol, value: unknown) {
        // Update state
        if (typeof key === "string" && key in state) {
          state[key as keyof T] = value as T[keyof T];
          // Notify all subscribers
          context.subscribe((changedKey) => {
            if (tracked.current[changedKey]) {
              tracked.current = {};
              rerender({});
            }
          });
        }
        return true;
      },
    }),
  ).current;

  React.useEffect(() => {
    const unsubscribe = subscribe((key) => {
      // Only re-render if this component tracks the changed property
      if (tracked.current[key]) {
        tracked.current = {};
        rerender({});
      }
    });
    return unsubscribe;
  }, [subscribe]);

  return proxy;
}

/**
 * Provider component that creates scoped state
 */
export function Provider<T extends Record<string, unknown>>({
  children,
  value,
}: {
  children: React.ReactNode;
  value: T;
}) {
  // Keep state in ref to avoid re-creating on renders
  const stateRef = React.useRef(value);
  const listenersRef = React.useRef(new Set<(key: keyof T) => void>());

  // Update state ref if value prop changes
  React.useEffect(() => {
    stateRef.current = value;
  }, [value]);

  const proxy = React.useMemo(
    () =>
      new Proxy({} as T, {
        get(_, key: string | symbol) {
          if (typeof key === "string" && key in stateRef.current) {
            return stateRef.current[key as keyof T];
          }
          return undefined;
        },
        set(_, key: string | symbol, value: unknown) {
          // Only update if value changed
          if (typeof key === "string" && key in stateRef.current) {
            const typedKey = key as keyof T;
            if (!Object.is(stateRef.current[typedKey], value)) {
              stateRef.current[typedKey] = value as T[keyof T];
              // Notify all listeners
              listenersRef.current.forEach((listener) => listener(typedKey));
            }
          }
          return true;
        },
      }),
    [],
  );

  const subscribe = React.useCallback(
    (listener: (key: keyof T) => void) => {
      listenersRef.current.add(listener as (key: keyof T) => void);
      return () => {
        listenersRef.current.delete(listener as (key: keyof T) => void);
      };
    },
    [],
  );

  const contextValue = React.useMemo(
    () => ({
      state: proxy,
      subscribe: subscribe as (
        listener: (key: string) => void,
      ) => () => void,
    }),
    [proxy, subscribe],
  );

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
}



