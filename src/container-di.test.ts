// src/container-di.test.ts
import { beforeEach, describe, expect, expectTypeOf, test } from 'vitest';
import {
    Constructor,
    Container,
    ContainerException,
    ContainerInterface,
    Inject,
    Injectable,
    NotFoundException,
    optional,
} from './container-di';

type ReflectMetadataShim = typeof Reflect & {
    getMetadata?: (metadataKey: string, target: object) => unknown;
};

function withReflectParamTypes<T>(paramTypes: Map<object, Array<unknown>>, callback: () => T): T {
    const reflectObject = Reflect as ReflectMetadataShim;
    const previousGetMetadata = reflectObject.getMetadata;

    reflectObject.getMetadata = (metadataKey, target) => {
        if (metadataKey !== 'design:paramtypes') {
            return undefined;
        }

        return paramTypes.get(target);
    };

    try {
        return callback();
    } finally {
        if (previousGetMetadata === undefined) {
            delete reflectObject.getMetadata;
        } else {
            reflectObject.getMetadata = previousGetMetadata;
        }
    }
}

const implementations = [Container];

describe.each(implementations)('Container', (Implementation) => {
    let container: ContainerInterface;

    beforeEach(() => {
        container = Implementation.make();
    });

    test(`${Implementation.name} > get non-existent item from container`, () => {
        expect(() => container.get(Math.random().toString())).toThrow(NotFoundException);
        expect(() => container.get(Math.random().toString())).not.toThrow(ContainerException);
    });

    test(`${Implementation.name} > has returns false for missing items and true for registered items`, () => {
        expect(container.has('missing')).toBe(false);

        container.set('missing', 'now registered');

        expect(container.has('missing')).toBe(true);
    });

    test(`${Implementation.name} > get preserves explicitly registered undefined values`, () => {
        container.set<undefined>('explicitUndefined', undefined);

        expect(container.has('explicitUndefined')).toBe(true);
        expect(container.get('explicitUndefined')).toBeUndefined();
    });

    test(`${Implementation.name} > supports symbol tokens`, () => {
        const token = Symbol('token');
        const value = { stable: true };

        container.set(token, value);

        expect(container.has(token)).toBe(true);
        expect(container.get(token)).toBe(value);
    });

    test(`${Implementation.name} > supports class constructor tokens`, () => {
        class Service {}

        const service = new Service();

        container.set(Service, service);

        expect(container.has(Service)).toBe(true);
        expect(container.get(Service)).toBe(service);
    });

    test(`${Implementation.name} > registers prebuilt values with instance`, () => {
        const settings = { mode: 'test' };

        expect(container.instance('settings', settings)).toBe(container);
        expect(container.isRegistered('settings')).toBe(true);
        expect(container.has('settings')).toBe(true);
        expect(container.get('settings')).toBe(settings);
    });

    test(`${Implementation.name} > binds classes as transient services`, () => {
        class Service {
            readonly id = Math.random();
        }

        container.bind('service', Service);

        const first = container.get<Service>('service');
        const second = container.get<Service>('service');

        expect(first).toBeInstanceOf(Service);
        expect(second).toBeInstanceOf(Service);
        expect(first).not.toBe(second);
        expect(first.id).not.toBe(second.id);
    });

    test(`${Implementation.name} > self-binds class tokens as transient services`, () => {
        class Service {
            readonly id = Math.random();
        }

        container.bind(Service);

        const first = container.get(Service);
        const second = container.get(Service);

        expect(first).toBeInstanceOf(Service);
        expect(second).toBeInstanceOf(Service);
        expect(first).not.toBe(second);
    });

    test(`${Implementation.name} > registers singleton class services`, () => {
        class Service {
            readonly id = Math.random();
        }

        container.singleton('service', Service);

        const first = container.get<Service>('service');
        const second = container.get<Service>('service');

        expect(first).toBeInstanceOf(Service);
        expect(first).toBe(second);
    });

    test(`${Implementation.name} > registers transient factory services`, () => {
        let calls = 0;

        container.factory('counter', () => {
            calls += 1;
            return { calls };
        });

        const first = container.get<{ calls: number }>('counter');
        const second = container.get<{ calls: number }>('counter');

        expect(first).toEqual({ calls: 1 });
        expect(second).toEqual({ calls: 2 });
        expect(first).not.toBe(second);
    });

    test(`${Implementation.name} > registers singleton factory services`, () => {
        let calls = 0;

        container.singleton('counter', () => {
            calls += 1;
            return { calls };
        });

        const first = container.get<{ calls: number }>('counter');
        const second = container.get<{ calls: number }>('counter');

        expect(first).toEqual({ calls: 1 });
        expect(second).toBe(first);
        expect(calls).toBe(1);
    });

    test(`${Implementation.name} > registers transient factories through transient`, () => {
        let calls = 0;

        container.transient('counter', () => {
            calls += 1;
            return calls;
        });

        expect(container.get('counter')).toBe(1);
        expect(container.get('counter')).toBe(2);
    });

    test(`${Implementation.name} > resolves aliases across token types`, () => {
        class Service {}

        const symbolToken = Symbol('service');
        const aliasToken = Symbol('serviceAlias');
        const service = new Service();

        container.instance(symbolToken, service);
        container.alias(aliasToken, symbolToken);
        container.alias('classAlias', Service);
        container.instance(Service, service);

        expect(container.has(aliasToken)).toBe(true);
        expect(container.isRegistered(aliasToken)).toBe(true);
        expect(container.get(aliasToken)).toBe(service);
        expect(container.get('classAlias')).toBe(service);
    });

    test(`${Implementation.name} > distinguishes direct registration from resolvable aliases`, () => {
        const target = Symbol('target');
        const alias = Symbol('alias');
        const value = { ok: true };

        container.alias(alias, target);

        expect(container.isRegistered(alias)).toBe(true);
        expect(container.isRegistered(target)).toBe(false);
        expect(container.has(alias)).toBe(false);

        container.instance(target, value);

        expect(container.has(alias)).toBe(true);
        expect(container.get(alias)).toBe(value);
    });

    test(`${Implementation.name} > intentionally overrides registrations`, () => {
        container.instance('value', 1);
        container.instance('value', 2);

        expect(container.get('value')).toBe(2);

        container.factory('value', () => 3);
        container.singleton('value', () => 4);

        expect(container.get('value')).toBe(4);
        expect(container.get('value')).toBe(4);
    });

    test(`${Implementation.name} > rejects non-class bind implementations`, () => {
        const factory = (() => ({ ok: true })) as unknown as Constructor<object>;

        expect(() => container.bind('invalid', factory)).toThrow(ContainerException);
    });

    test(`${Implementation.name} > autowires class constructor dependencies with explicit tokens`, () => {
        class Logger {
            readonly id = Math.random();
        }

        class Service {
            constructor(readonly logger: Logger) {}
        }

        container.inject(Service, [Logger]);
        container.bind(Service);

        const service = container.get(Service);

        expect(service).toBeInstanceOf(Service);
        expect(service.logger).toBeInstanceOf(Logger);
    });

    test(`${Implementation.name} > autowires constructor dependencies from reflect metadata when available`, () => {
        class Logger {}

        class Service {
            constructor(readonly logger: Logger) {}
        }

        withReflectParamTypes(new Map<object, Array<unknown>>([[Service, [Logger]]]), () => {
            container.bind(Service);

            const service = container.get(Service);

            expect(service).toBeInstanceOf(Service);
            expect(service.logger).toBeInstanceOf(Logger);
        });
    });

    test(`${Implementation.name} > supports explicit interface-like symbol dependencies`, () => {
        interface Logger {
            message(): string;
        }

        const loggerToken = Symbol('Logger');
        const logger: Logger = {
            message: () => 'ready',
        };

        class Service {
            constructor(readonly logger: Logger) {}
        }

        container.instance(loggerToken, logger);
        container.inject(Service, [loggerToken]);
        container.bind(Service);

        expect(container.get(Service).logger.message()).toBe('ready');
    });

    test(`${Implementation.name} > supports class decorator dependency metadata`, () => {
        interface Logger {
            message(): string;
        }

        const loggerToken = Symbol('Logger');
        const logger: Logger = {
            message: () => 'decorated',
        };

        class Service {
            constructor(readonly logger: Logger) {}
        }

        Injectable([loggerToken])(Service);
        container.instance(loggerToken, logger);
        container.bind(Service);

        expect(container.get(Service).logger.message()).toBe('decorated');
    });

    test(`${Implementation.name} > supports parameter decorator dependency metadata`, () => {
        interface Logger {
            message(): string;
        }

        const loggerToken = Symbol('Logger');
        const logger: Logger = {
            message: () => 'parameter',
        };

        class Service {
            constructor(readonly logger: Logger) {}
        }

        Inject(loggerToken)(Service, undefined, 0);
        container.instance(loggerToken, logger);
        container.bind(Service);

        expect(container.get(Service).logger.message()).toBe('parameter');
    });

    test(`${Implementation.name} > injects undefined only for explicitly optional missing dependencies`, () => {
        interface Logger {
            message(): string;
        }

        const loggerToken = Symbol('Logger');

        class Service {
            constructor(readonly logger?: Logger) {}
        }

        container.inject(Service, [optional(loggerToken)]);
        container.bind(Service);

        expect(container.get(Service).logger).toBeUndefined();
    });

    test(`${Implementation.name} > rejects required constructor dependencies without metadata`, () => {
        class Service {
            constructor(readonly value: string) {}
        }

        container.bind(Service);

        expect(() => container.get(Service)).toThrow(ContainerException);
        expect(() => container.get(Service)).toThrow(/Cannot infer dependency #0/);
    });

    test(`${Implementation.name} > rejects ambiguous reflected Object metadata`, () => {
        interface Logger {
            message(): string;
        }

        class Service {
            constructor(readonly logger: Logger) {}
        }

        withReflectParamTypes(new Map<object, Array<unknown>>([[Service, [Object]]]), () => {
            container.bind(Service);

            expect(() => container.get(Service)).toThrow(ContainerException);
            expect(() => container.get(Service)).toThrow(/ambiguous/);
        });
    });

    test(`${Implementation.name} > caches singleton services after autowiring dependencies`, () => {
        class Dependency {
            readonly id = Math.random();
        }

        class Service {
            constructor(readonly dependency: Dependency) {}
        }

        container.inject(Service, [Dependency]);
        container.singleton(Service);

        const first = container.get(Service);
        const second = container.get(Service);

        expect(first).toBe(second);
        expect(first.dependency).toBe(second.dependency);
        expect(first.dependency).toBeInstanceOf(Dependency);
    });

    test(`${Implementation.name} > applies contextual class overrides per consumer`, () => {
        interface Logger {
            channel: string;
        }

        const loggerToken = Symbol('Logger');

        class ConsoleLogger implements Logger {
            readonly channel = 'console';
        }

        class FileLogger implements Logger {
            readonly channel = 'file';
        }

        class ConsoleConsumer {
            constructor(readonly logger: Logger) {}
        }

        class FileConsumer {
            constructor(readonly logger: Logger) {}
        }

        container.inject(ConsoleConsumer, [loggerToken]);
        container.inject(FileConsumer, [loggerToken]);
        container.when(ConsoleConsumer).needs(loggerToken).give(ConsoleLogger);
        container.when(FileConsumer).needs(loggerToken).giveClass(FileLogger);
        container.bind(ConsoleConsumer);
        container.bind(FileConsumer);

        expect(container.get(ConsoleConsumer).logger).toBeInstanceOf(ConsoleLogger);
        expect(container.get(ConsoleConsumer).logger.channel).toBe('console');
        expect(container.get(FileConsumer).logger).toBeInstanceOf(FileLogger);
        expect(container.get(FileConsumer).logger.channel).toBe('file');
    });

    test(`${Implementation.name} > keeps unrelated consumers on global bindings`, () => {
        interface Logger {
            channel: string;
        }

        const loggerToken = Symbol('Logger');
        const defaultLogger: Logger = { channel: 'default' };

        class SpecialLogger implements Logger {
            readonly channel = 'special';
        }

        class SpecialConsumer {
            constructor(readonly logger: Logger) {}
        }

        class DefaultConsumer {
            constructor(readonly logger: Logger) {}
        }

        container.instance(loggerToken, defaultLogger);
        container.inject(SpecialConsumer, [loggerToken]);
        container.inject(DefaultConsumer, [loggerToken]);
        container.when(SpecialConsumer).needs(loggerToken).giveClass(SpecialLogger);
        container.bind(SpecialConsumer);
        container.bind(DefaultConsumer);

        expect(container.get(SpecialConsumer).logger).toBeInstanceOf(SpecialLogger);
        expect(container.get(DefaultConsumer).logger).toBe(defaultLogger);
    });

    test(`${Implementation.name} > supports contextual value overrides`, () => {
        const configToken = Symbol('Config');

        class Consumer {
            constructor(readonly config: { mode: string }) {}
        }

        container.inject(Consumer, [configToken]);
        container.when(Consumer).needs(configToken).giveValue({ mode: 'contextual' });
        container.bind(Consumer);

        expect(container.get(Consumer).config).toEqual({ mode: 'contextual' });
    });

    test(`${Implementation.name} > supports contextual factory overrides`, () => {
        const counterToken = Symbol('Counter');
        let calls = 0;

        class Consumer {
            constructor(readonly count: number) {}
        }

        container.inject(Consumer, [counterToken]);
        container
            .when(Consumer)
            .needs(counterToken)
            .giveFactory(() => {
                calls += 1;
                return calls;
            });
        container.bind(Consumer);

        expect(container.get(Consumer).count).toBe(1);
        expect(container.get(Consumer).count).toBe(2);
    });

    test(`${Implementation.name} > supports contextual token forwarding`, () => {
        interface Logger {
            channel: string;
        }

        const loggerToken = Symbol('Logger');
        const fileLoggerToken = Symbol('FileLogger');
        const fileLogger: Logger = { channel: 'file' };

        class Consumer {
            constructor(readonly logger: Logger) {}
        }

        container.instance(fileLoggerToken, fileLogger);
        container.inject(Consumer, [loggerToken]);
        container.when(Consumer).needs(loggerToken).giveToken(fileLoggerToken);
        container.bind(Consumer);

        expect(container.get(Consumer).logger).toBe(fileLogger);
    });

    test(`${Implementation.name} > matches contextual bindings by owner registration token`, () => {
        interface Logger {
            channel: string;
        }

        const loggerToken = Symbol('Logger');
        const contextualLogger: Logger = { channel: 'registered-token' };

        class Consumer {
            constructor(readonly logger: Logger) {}
        }

        container.inject(Consumer, [loggerToken]);
        container.when('consumer').needs(loggerToken).giveValue(contextualLogger);
        container.bind('consumer', Consumer);

        expect(container.get<Consumer>('consumer').logger).toBe(contextualLogger);
    });

    test(`${Implementation.name} > detects contextual circular dependencies`, () => {
        const dependencyToken = Symbol('Dependency');

        class Consumer {
            constructor(readonly dependency: unknown) {}
        }

        container.inject(Consumer, [dependencyToken]);
        container.when(Consumer).needs(dependencyToken).giveToken(Consumer);
        container.bind(Consumer);

        expect(() => container.get(Consumer)).toThrow(ContainerException);
        expect(() => container.get(Consumer)).toThrow(/Consumer -> Symbol\(Dependency\) -> Consumer/);
    });

    test(`${Implementation.name} > detects direct class circular dependencies`, () => {
        class Service {
            constructor(readonly service: Service) {}
        }

        container.inject(Service, [Service]);
        container.bind(Service);

        expect(() => container.get(Service)).toThrow(ContainerException);
        expect(() => container.get(Service)).toThrow(/Service -> Service/);
    });

    test(`${Implementation.name} > detects indirect class circular dependencies`, () => {
        class ServiceA {
            constructor(readonly serviceB: ServiceB) {}
        }

        class ServiceB {
            constructor(readonly serviceA: ServiceA) {}
        }

        container.inject(ServiceA, [ServiceB]);
        container.inject(ServiceB, [ServiceA]);
        container.bind(ServiceA);
        container.bind(ServiceB);

        expect(() => container.get(ServiceA)).toThrow(ContainerException);
        expect(() => container.get(ServiceA)).toThrow(/ServiceA -> ServiceB -> ServiceA/);
    });

    test(`${Implementation.name} > detects alias circular dependencies`, () => {
        container.alias('serviceA', 'serviceB');
        container.alias('serviceB', 'serviceA');

        expect(container.has('serviceA')).toBe(false);
        expect(() => container.get('serviceA')).toThrow(ContainerException);
        expect(() => container.get('serviceA')).toThrow(/"serviceA" -> "serviceB" -> "serviceA"/);
    });

    test(`${Implementation.name} > detects direct factory circular dependencies`, () => {
        container.factory('service', (currentContainer) => currentContainer.get('service'));

        expect(() => container.get('service')).toThrow(ContainerException);
        expect(() => container.get('service')).toThrow(/"service" -> "service"/);
    });

    test(`${Implementation.name} > detects indirect factory circular dependencies`, () => {
        container.factory('serviceA', (currentContainer) => currentContainer.get('serviceB'));
        container.factory('serviceB', (currentContainer) => currentContainer.get('serviceA'));

        expect(() => container.get('serviceA')).toThrow(ContainerException);
        expect(() => container.get('serviceA')).toThrow(/"serviceA" -> "serviceB" -> "serviceA"/);
    });

    test(`${Implementation.name} > wraps factory failures with preserved cause`, () => {
        const cause = new Error('factory exploded');

        container.factory('broken', () => {
            throw cause;
        });
        container.instance('healthy', 'ok');

        expect(() => container.get('broken')).toThrow(ContainerException);

        try {
            container.get('broken');
        } catch (error) {
            expect(error).toBeInstanceOf(ContainerException);
            expect((error as ContainerException).cause).toBe(cause);
        }

        expect(container.get('healthy')).toBe('ok');
    });

    test(`${Implementation.name} > set and get non-callable values`, () => {
        const bar = Math.random();

        // @ts-expect-error ts(7052)
        container['foo'] = bar.toString();
        expect(container.has('foo')).toBe(true);
        // @ts-expect-error ts(7052)
        expect(container['foo']).toBe(bar.toString());
        expectTypeOf(container.get<string>('foo')).toBeString();

        container.set('foo', bar);
        expect(container.has('foo')).toBe(true);
        expect(container.get('foo')).toBe(bar);

        expectTypeOf(container.get<typeof bar>('foo')).toBeNumber();

        const baz = [Math.random(), Math.random(), Math.random()];

        container.set('foo', baz);
        expect(container.has('foo')).toBe(true);
        expect(container.get('foo')).toEqual(baz);

        expectTypeOf(container.get<typeof baz>('foo')).toBeArray();

        const xyz = { a: Math.random(), b: Math.random() };

        container.set('xyz', xyz);
        expect(container.has('xyz')).toBe(true);
        expect(container.get('xyz')).toEqual(xyz);
        const result = container.get<typeof xyz>('xyz');
        expect(result.a).toEqual(xyz.a);
        expect(result.b).toEqual(xyz.b);

        expectTypeOf(result).toBeObject();
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
        expect(serviceA === serviceB).toBe(true);
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
        expect(serviceA === serviceB).toBe(true);
    });
});
