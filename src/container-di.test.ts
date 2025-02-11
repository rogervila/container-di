// src/container-di.test.ts
import { beforeEach, describe, expect, test } from 'vitest';
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

        container.set('foo', bar);
        expect(container.has('foo')).toBe(true);
        expect(container.get('foo')).toBe(bar);

        const baz = [Math.random(), Math.random(), Math.random()];

        container.set('foo', baz);
        expect(container.has('foo')).toBe(true);
        expect(container.get('foo')).toEqual(baz);
    });

    test(`${Implementation.name} > set and get callable values`, () => {
        container.set('foo', (a: number, b: number) => a + b);
        expect(container.has('foo')).toBe(true);

        const result = container.get('foo');
        expect(typeof result).toBe('function');

        const a = Math.random();
        const b = Math.random();

        expect(result(a, b)).toEqual(a + b);
    });
});
