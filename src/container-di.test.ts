// src/container-di.test.ts
import { beforeEach, describe, expect, expectTypeOf, test } from 'vitest';
import { Container, ContainerInterface, NotFoundException } from './container-di';

const implementations = [Container];

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

        expectTypeOf(container.get<typeof bar>('foo')).toBeNumber();

        const baz = [Math.random(), Math.random(), Math.random()];

        container.set('foo', baz);
        expect(container.has('foo')).toBe(true);
        expect(container.get('foo')).toEqual(baz);

        expectTypeOf(container.get<typeof baz>('foo')).toBeArray();
    });

    test(`${Implementation.name} > set and get callable values with container`, () => {
        class Service {
            constructor(private token: string) {}

            getToken(): string {
                return this.token;
            }
        }

        const token = Math.random().toString();

        const callable = (c: ContainerInterface): Service => new Service(c.get('token'));

        container.set('token', token);
        container.set('service', callable);
        expect(container.has('service')).toBe(true);

        const serviceA = container.get<Service>('service');
        expect(serviceA).toBeInstanceOf(Service);

        expect(serviceA.getToken()).toEqual(token);

        const serviceB = container.get<Service>('service');
        expect(serviceB).toBe(serviceA);
    });

    test(`${Implementation.name} > set and get callable values with container via proxy`, () => {
        class Service {
            constructor(private token: string) {}

            getToken(): string {
                return this.token;
            }
        }

        const token = Math.random().toString();

        const callable = (c: ContainerInterface): Service => new Service(c.get('token'));

        // @ts-expect-error ts(7052)
        container['token'] = token;
        // @ts-expect-error ts(7052)
        container['service'] = callable;
        expect(container.has('service')).toBe(true);
        // @ts-expect-error ts(7052)
        const serviceA: Service = container['service'];
        expect(serviceA).toBeInstanceOf(Service);

        expect(serviceA.getToken()).toEqual(token);

        // @ts-expect-error ts(7052)
        const serviceB: Service = container['service'];
        expect(serviceB).toBe(serviceA);
    });
});
