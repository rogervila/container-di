// src/container-di.test.ts
import { beforeEach, describe, expect, expectTypeOf, test } from 'vitest';
import {
    ContainerInterface,
    InMemoryContainer,
    LocalStorageContainer,
    NotFoundException,
    SessionStorageContainer,
} from './container-di';

const implementations = [InMemoryContainer, SessionStorageContainer, LocalStorageContainer];

describe.each(implementations)('Container', (Implementation) => {
    let container: ContainerInterface;

    beforeEach(() => {
        container = Implementation.make();
    });

    test(`${Implementation.name} > get non-existent item from container`, () => {
        expect(() => container.get(Math.random().toString())).toThrow(NotFoundException);
    });

    test(`${Implementation.name} > set and get non-callable values`, () => {
        const bar = Math.random();

        // @ts-expect-error ts(7052)
        container['foo'] = bar.toString();
        expect(container.has('foo')).toBe(true);
        // @ts-expect-error ts(7052)
        expect(container['foo']).toBe(bar.toString());
        // @ts-expect-error ts(2349)
        expectTypeOf(container.get('foo')).toBeString();

        container.set('foo', bar);
        expect(container.has('foo')).toBe(true);
        expect(container.get('foo')).toBe(bar);
        // @ts-expect-error ts(2349)
        expectTypeOf(container.get('foo')).toBeNumber();

        const baz = [Math.random(), Math.random(), Math.random()];

        container.set('foo', baz);
        expect(container.has('foo')).toBe(true);
        expect(container.get('foo')).toEqual(baz);
        // @ts-expect-error ts(2349)
        expectTypeOf(container.get('foo')).toBeArray();
    });

    test(`${Implementation.name} > set and get callable values`, () => {
        container.set('foo', (a: number, b: number) => a + b);
        expect(container.has('foo')).toBe(true);

        const result = container.get('foo');
        // @ts-expect-error ts(2349)
        expectTypeOf(result).toBeFunction();

        const a = Math.random();
        const b = Math.random();

        expect(result(a, b)).toEqual(a + b);
    });
});

const storageImplementations: Storage[] = [localStorage, sessionStorage];

describe.each(storageImplementations)('Storage', (Implementation) => {
    let storage: Storage;
    let container: ContainerInterface;

    beforeEach(() => {
        storage = Implementation;
        container = Implementation === localStorage ? LocalStorageContainer.make() : SessionStorageContainer.make();
    });

    test(`${Implementation === localStorage ? 'localStorage' : 'sessionStorage'} > handle non-callable values`, () => {
        const key = Math.random().toString();
        const value = Math.random().toString();

        container.set(key, value);
        expect(container.has(key)).toBe(true);

        expect(container.get(key)).toEqual(value);
        expect(storage.getItem(key)).toEqual(`"${value}"`);

        storage.removeItem(key);
        expect(container.has(key)).toBe(false);
    });

    test(`${Implementation === localStorage ? 'localStorage' : 'sessionStorage'} > handle callable values`, () => {
        const key = Math.random().toString();
        const value = (a: number, b: number) => a + b;

        container.set(key, value);
        expect(container.has(key)).toBe(true);

        // @ts-expect-error ts(2349)
        expectTypeOf(container.get(key)).toBeFunction();
        expect(storage.getItem(key)).toEqual(`return (${value.toString()})`);

        storage.removeItem(key);
        expect(container.has(key)).toBe(false);
    });
});
