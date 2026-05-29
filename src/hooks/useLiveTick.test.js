import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveTick } from './useLiveTick.js';

describe('useLiveTick — simulated path', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('seeds with the initial price and source=sim', () => {
    const { result } = renderHook(() => useLiveTick(2000, { intervalMs: 1000, simulate: true }));
    expect(result.current.price).toBe(2000);
    expect(result.current.source).toBe('sim');
  });

  it('advances on interval ticks', () => {
    const { result } = renderHook(() => useLiveTick(2000, { intervalMs: 1000, simulate: true }));
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(result.current.n).toBeGreaterThanOrEqual(3);
  });
});

describe('useLiveTick — live WebSocket path', () => {
  class MockWS {
    static instances = [];
    constructor(url) {
      MockWS.instances.push(this);
      this.url = url;
      this.listeners = {};
    }
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    }
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
    }
    close() {}
    emit(type, evt) {
      (this.listeners[type] || []).forEach((fn) => fn(evt));
    }
  }

  beforeEach(() => {
    MockWS.instances = [];
  });

  it('subscribes when url is provided and updates on messages', () => {
    const { result } = renderHook(() =>
      useLiveTick(2000, { url: 'wss://example.test', WebSocketImpl: MockWS }),
    );
    expect(MockWS.instances).toHaveLength(1);
    act(() => {
      MockWS.instances[0].emit('message', { data: JSON.stringify({ price: 2050.5 }) });
    });
    expect(result.current.price).toBe(2050.5);
    expect(result.current.source).toBe('live');
    expect(result.current.dir).toBe(1);
  });

  it('handles numeric payload', () => {
    const { result } = renderHook(() =>
      useLiveTick(2000, { url: 'wss://example.test', WebSocketImpl: MockWS }),
    );
    act(() => {
      MockWS.instances[0].emit('message', { data: '1999' });
    });
    expect(result.current.price).toBe(1999);
    expect(result.current.dir).toBe(-1);
  });
});
