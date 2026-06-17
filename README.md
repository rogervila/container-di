# Container DI

[![npm version](https://badge.fury.io/js/container-di.svg "Current npm version")](https://badge.fury.io/js/container-di "View on npm")
[![npm downloads](https://img.shields.io/npm/dt/container-di.svg "Total downloads")](https://www.npmjs.com/package/container-di "View on npm")
[![npm license](https://img.shields.io/npm/l/container-di.svg "License")](https://www.npmjs.com/package/container-di "View on npm")

`container-di` is a lightweight, framework-agnostic dependency injection container for TypeScript.

The core `get()` and `has()` methods follow PSR-11-style container access semantics adapted to TypeScript. The registration API, lifetimes, aliases, factories, autowiring, decorator helpers, contextual bindings, and circular dependency detection are additional DI conveniences inspired by containers such as Laravel's service container and PHP-DI. Those advanced features are not PSR-11 features.

## Table of Contents

- [Highlights](#highlights)
- [Installation](#installation)
- [Runtime Compatibility](#runtime-compatibility)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [PSR-11-Style Core](#psr-11-style-core)
- [Tokens](#tokens)
- [Registration API](#registration-api)
- [Lifetimes](#lifetimes)
- [Factories](#factories)
- [Aliases](#aliases)
- [Backward-Compatible `set()`](#backward-compatible-set)
- [Proxy Access](#proxy-access)
- [Constructor Autowiring](#constructor-autowiring)
- [Interfaces and Explicit Tokens](#interfaces-and-explicit-tokens)
- [Decorator Helpers and Metadata](#decorator-helpers-and-metadata)
- [Optional Dependencies](#optional-dependencies)
- [Contextual Bindings](#contextual-bindings)
- [Circular Dependencies](#circular-dependencies)
- [Error Handling](#error-handling)
- [Cloudflare Workers](#cloudflare-workers)
- [TypeScript Notes](#typescript-notes)
- [Packaging](#packaging)
- [API Reference](#api-reference)
- [Migration Notes](#migration-notes)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Highlights

- PSR-11-style `get()` and `has()` access methods.
- Runtime `NotFoundException` and `ContainerException` classes.
- String, symbol, and class constructor tokens.
- Class, value, factory, singleton, transient, and alias registrations.
- Explicit dependency metadata for erased TypeScript types and interfaces.
- Optional constructor autowiring through `Reflect.getMetadata('design:paramtypes', Class)` when available.
- Decorator helpers: `Injectable()`, `Inject()`, and `optional()`.
- Contextual bindings with `when(context).needs(token)`.
- Direct and indirect circular dependency detection with readable chains.
- Synchronous, dependency-free runtime suitable for Node.js, modern bundlers, browser-like runtimes, and Cloudflare Workers.
- TypeScript 6.x compatible declarations.

## Installation

```bash
pnpm add container-di
```

```bash
npm install container-di
```

```bash
yarn add container-di
```

Use the package root export:

```typescript
import { Container } from 'container-di';
```

CommonJS consumers can use the package `require` export:

```javascript
const { Container } = require('container-di');
```

## Runtime Compatibility

- Runtime target: ES2020.
- Package output: ESM and UMD/CJS.
- Type declarations: `dist/container-di.d.ts`.
- Runtime dependencies: none.
- Framework dependencies: none.
- Node-only runtime APIs: none in the library source or ESM bundle.
- Cloudflare Workers: compatible without requiring `nodejs_compat` for the container itself.
- TypeScript: validated with TypeScript 6.x.
- Metadata: optional; the library does not import `reflect-metadata`.

The repository includes a Worker/package compatibility check:

```bash
pnpm check:workers
```

That command builds the package, verifies the ESM and declaration entry points, scans the source and ESM bundle for Node-only runtime markers, imports the built ESM bundle, and performs a basic container resolution check.

## Quick Start

```typescript
import { Container } from 'container-di';

class Database {
    query(sql: string): string {
        return `running: ${sql}`;
    }
}

class UserRepository {
    constructor(readonly database: Database) {}

    findUser(id: string): string {
        return this.database.query(`select * from users where id = ${id}`);
    }
}

const container = Container.make();

container.singleton(Database);
container.inject(UserRepository, [Database]);
container.bind(UserRepository);

const repository = container.get(UserRepository);

console.log(repository.findUser('42'));
```

The example uses `inject(UserRepository, [Database])` for explicit constructor metadata. This is the most portable autowiring style because it does not require decorators or runtime reflection metadata.

## Core Concepts

### Container

A `Container` stores registrations and resolves tokens into values or service instances.

```typescript
const container = Container.make();
```

`Container.make()` returns a proxy-backed container. The proxy preserves legacy bracket access for string keys, but explicit methods are recommended for new code.

### Entry

An entry is anything the container can return from `get(token)`: a primitive, object, function value, class instance, factory result, singleton, or alias target.

### Token

A token is the public identifier for an entry. Tokens can be strings, symbols, or class constructors.

### Binding

A binding is a registration that tells the container how to produce an entry. Bindings can represent values, classes, factories, aliases, singletons, transients, or contextual overrides.

### Resolution

Resolution is synchronous. `get(token)` returns a value immediately or throws. If a factory returns a `Promise`, the promise is returned as the entry value; the container does not await it.

## PSR-11-Style Core

PSR-11 itself is intentionally minimal. It defines container access semantics, especially `get()` and `has()`, plus exception behavior. It does not define registration, autowiring, factories, aliases, lifetimes, decorators, contextual bindings, or circular dependency handling.

`container-di` adapts that small access model to TypeScript:

- `get(id)` returns the entry associated with `id`.
- `get(id)` throws `NotFoundException` when no entry exists.
- `get(id)` throws `ContainerException` when an entry exists but cannot be resolved.
- `has(id)` returns `true` when the container can resolve a registered entry.
- `has(id)` returns `false` for missing entries and unresolved alias cycles.

```typescript
import { Container, ContainerException, NotFoundException } from 'container-di';

const container = Container.make();

container.instance('config', { region: 'eu' });

console.log(container.has('config')); // true
console.log(container.get<{ region: string }>('config').region); // 'eu'
console.log(container.has('missing')); // false

try {
    container.get('missing');
} catch (error) {
    if (error instanceof NotFoundException) {
        console.log('Entry was not found');
    } else if (error instanceof ContainerException) {
        console.log('Entry exists but could not be resolved');
    }
}
```

`NotFoundExceptionInterface` and `ContainerExceptionInterface` are TypeScript interfaces. `NotFoundException` and `ContainerException` are runtime classes.

### `has()` Is Not a Dry Run

`has()` does not instantiate classes and does not execute factories. For non-alias registrations, it reports that a token is registered. For aliases, it verifies that the alias chain reaches a registered token and is not cyclic.

That means `has(Service)` can return `true` even if `get(Service)` later fails because constructor metadata is missing, a factory throws, or a nested dependency cannot be resolved.

```typescript
class Service {
    constructor(readonly value: string) {}
}

container.bind(Service);

console.log(container.has(Service)); // true
container.get(Service); // throws because `string` has no injection token
```

### TypeScript Token Adaptation

PHP PSR-11 uses string identifiers. `container-di` accepts TypeScript-friendly tokens:

- strings;
- symbols;
- class constructors.

Advanced registration methods such as `bind()`, `singleton()`, `factory()`, `alias()`, `inject()`, and `when()` are additional DI conveniences. They are not part of PSR-11.

## Tokens

The exported token type is:

```typescript
type Token<T = unknown> = string | symbol | AbstractConstructor<T>;
```

### String Tokens

String tokens are convenient for configuration and simple values.

```typescript
container.instance('app.name', 'billing');

const name = container.get<string>('app.name');
```

String tokens are easy to read, but they can collide. For public libraries and interface-like dependencies, prefer symbols or class constructors.

### Symbol Tokens

Symbol tokens are ideal for TypeScript interfaces because interfaces disappear at runtime.

```typescript
import { Container, Token } from 'container-di';

interface Logger {
    info(message: string): void;
}

const LoggerToken: Token<Logger> = Symbol('Logger');

class ConsoleLogger implements Logger {
    info(message: string): void {
        console.log(message);
    }
}

const container = Container.make();

container.instance(LoggerToken, new ConsoleLogger());
const logger = container.get(LoggerToken);

logger.info('ready');
```

Symbols are identity-based. Two symbols with the same description are still different tokens.

```typescript
const first = Symbol('Logger');
const second = Symbol('Logger');

console.log(first === second); // false
```

### Class Constructor Tokens

Class tokens are natural for concrete services.

```typescript
class Cache {}

container.singleton(Cache);

const cache = container.get(Cache);
```

Top-level `get(Class)` requires that the class token be registered. Constructor autowiring can instantiate concrete dependency classes transiently even when those dependency classes are not globally registered.

## Registration API

The fluent registration API is the preferred API for new code.

```typescript
container.instance('config', { dsn: 'postgres://localhost/app' });
container.bind('users', UserRepository);
container.bind(UserRepository);
container.transient('requestId', () => crypto.randomUUID());
container.singleton(Database);
container.singleton('clock', () => new Date());
container.factory('nonce', () => crypto.randomUUID());
container.alias('db', Database);
```

Every registration method intentionally overrides any existing registration for the same token. The last registration wins.

```typescript
container.instance('mode', 'production');
container.instance('mode', 'test');

console.log(container.get('mode')); // 'test'
```

### `bind(token, Class?)`

Registers a transient class binding. If the token itself is a class constructor, the implementation can be omitted.

```typescript
class Mailer {}

container.bind(Mailer);

const first = container.get(Mailer);
const second = container.get(Mailer);

console.log(first === second); // false
```

```typescript
container.bind('mailer', Mailer);

const mailer = container.get<Mailer>('mailer');
```

`bind()` is class-only. Passing a non-class function to `bind()` throws `ContainerException`. Use `factory()` or `transient()` for factory callbacks.

### `transient(token, ClassOrFactory?)`

Registers a class or factory that runs for each resolution.

```typescript
class RequestScopeValue {
    readonly createdAt = Date.now();
}

container.transient(RequestScopeValue);
container.transient('request.id', () => crypto.randomUUID());
```

### `singleton(token, ClassOrFactory?)`

Registers a class or factory that is created once per container and cached after the first successful resolution.

```typescript
class ConnectionPool {}

container.singleton(ConnectionPool);

const first = container.get(ConnectionPool);
const second = container.get(ConnectionPool);

console.log(first === second); // true
```

If singleton construction fails, no partial value is cached. The next `get()` attempts construction again.

### `instance(token, value)`

Stores a prebuilt value exactly as provided.

```typescript
const settings = Object.freeze({ debug: false });

container.instance('settings', settings);

console.log(container.get('settings') === settings); // true
```

Use `instance()` when you need to store a function as a value. `set()` treats functions as eager factories for backward compatibility.

```typescript
const formatter = (value: string) => value.toUpperCase();

container.instance('formatter', formatter);

const resolved = container.get<typeof formatter>('formatter');

console.log(resolved('ok')); // 'OK'
```

### `factory(token, callback)`

Registers a transient factory callback.

```typescript
container.factory('now', () => new Date());

const first = container.get<Date>('now');
const second = container.get<Date>('now');

console.log(first === second); // false
```

### `alias(aliasToken, targetToken)`

Registers one token as an alias of another token.

```typescript
container.singleton(Database);
container.alias('db', Database);

console.log(container.get('db') === container.get(Database)); // true
```

### `isRegistered(token)`

Checks only whether a token is directly registered.

```typescript
container.alias('db', Database);

console.log(container.isRegistered('db')); // true
console.log(container.isRegistered(Database)); // false until Database is registered
console.log(container.has('db')); // false until Database is resolvable
```

## Lifetimes

| Lifetime | API | Behavior |
|---|---|---|
| Instance | `instance(token, value)` | Returns the exact prebuilt value. |
| Transient class | `bind(token, Class)`, `transient(token, Class)` | Creates a new instance for each resolution. |
| Transient factory | `factory(token, callback)`, `transient(token, callback)` | Calls the factory for each resolution. |
| Singleton class | `singleton(token, Class)` | Creates one instance per container. |
| Singleton factory | `singleton(token, callback)` | Calls the factory once per container. |
| Alias | `alias(aliasToken, targetToken)` | Resolves through another token. |

Transient dependencies inside singleton services are resolved while the singleton is being constructed. They are not re-resolved on later singleton reads because the singleton itself is cached.

```typescript
class Dependency {
    readonly id = crypto.randomUUID();
}

class Service {
    constructor(readonly dependency: Dependency) {}
}

container.inject(Service, [Dependency]);
container.singleton(Service);

const first = container.get(Service);
const second = container.get(Service);

console.log(first === second); // true
console.log(first.dependency === second.dependency); // true
```

## Factories

Factories receive the current `ContainerInterface`.

```typescript
import { ContainerInterface } from 'container-di';

class ApiClient {
    constructor(readonly baseUrl: string) {}
}

container.instance('api.baseUrl', 'https://api.example.com');
container.factory('api.client', (currentContainer: ContainerInterface) => {
    return new ApiClient(currentContainer.get('api.baseUrl'));
});
```

Factories are synchronous from the container's perspective. Returning a promise is allowed as the entry value, but the container does not await it.

```typescript
container.factory('payload', () => fetch('https://example.com').then((response) => response.json()));

const payloadPromise = container.get<Promise<unknown>>('payload');
const payload = await payloadPromise;
```

Factories participate in circular dependency detection while the callback is running.

## Aliases

Aliases are useful for naming, interface-like indirection, and compatibility layers.

```typescript
class ConsoleLogger {}

const LoggerToken = Symbol('Logger');

container.singleton(ConsoleLogger);
container.alias(LoggerToken, ConsoleLogger);

const logger = container.get(LoggerToken);
```

Alias chains are supported:

```typescript
container.alias('logger', LoggerToken);
container.alias('app.logger', 'logger');
```

Alias cycles are detected:

```typescript
container.alias('a', 'b');
container.alias('b', 'a');

container.get('a'); // throws ContainerException with chain "a" -> "b" -> "a"
```

## Backward-Compatible `set()`

`set()` remains for existing users.

- Non-function values are stored as instances.
- Function values are invoked immediately with the container.
- The factory result is stored as an instance.
- The function itself is not stored.

```typescript
import { Container, ContainerInterface } from 'container-di';

const container = Container.make();

class Service {
    constructor(readonly name: string) {}
}

container.set('name', 'api');
container.set('service', (currentContainer: ContainerInterface) => new Service(currentContainer.get('name')));

const first = container.get<Service>('service');
const second = container.get<Service>('service');

console.log(first === second); // true
```

Prefer `instance()`, `factory()`, `singleton()`, or `transient()` in new code because they make lifetime intent explicit.

## Proxy Access

`Container.make()` returns a proxy-backed container. String property access falls back to `get()` and `set()`.

```typescript
const container = Container.make();

container['apiKey'] = 'secret';
console.log(container['apiKey']); // 'secret'
```

Proxy access is mostly for compatibility and convenience. Method calls are clearer for typed code, symbol tokens, class tokens, and advanced registration.

## Constructor Autowiring

Autowiring works for class bindings. The container resolves constructor dependencies in this order:

1. Container-local explicit dependency metadata from `container.inject(Class, dependencies)`.
2. Parameter metadata from `Inject(token)`.
3. Class metadata from `Injectable([...])`.
4. Runtime `Reflect.getMetadata('design:paramtypes', Class)` metadata when available.

Explicit metadata is the most predictable option.

```typescript
class Logger {}

class AuditService {
    constructor(readonly logger: Logger) {}
}

container.inject(AuditService, [Logger]);
container.bind(AuditService);

const service = container.get(AuditService);
```

If dependency metadata is missing for a required constructor parameter, resolution fails.

```typescript
class Service {
    constructor(readonly url: string) {}
}

container.bind(Service);
container.get(Service); // throws ContainerException
```

This is intentional. TypeScript does not preserve constructor parameter types reliably at runtime unless metadata is emitted and available, and interfaces are always erased.

## Interfaces and Explicit Tokens

Interfaces are compile-time only. They do not exist at runtime and cannot be used directly as tokens.

Use a symbol token:

```typescript
import { Container, Token } from 'container-di';

interface Logger {
    info(message: string): void;
}

const LoggerToken: Token<Logger> = Symbol('Logger');

class ConsoleLogger implements Logger {
    info(message: string): void {
        console.log(message);
    }
}

class JobRunner {
    constructor(readonly logger: Logger) {}
}

const container = Container.make();

container.instance(LoggerToken, new ConsoleLogger());
container.inject(JobRunner, [LoggerToken]);
container.bind(JobRunner);

container.get(JobRunner).logger.info('running');
```

You can also bind the token to a class:

```typescript
container.bind(LoggerToken, ConsoleLogger);
```

Use explicit tokens for:

- TypeScript interfaces.
- Abstract concepts.
- Primitive constructor parameters such as `string`, `number`, and `boolean`.
- Object-shaped parameters.
- Union types.
- Generic type parameters.

## Decorator Helpers and Metadata

The library exports decorator helpers that write metadata into internal weak maps. They are optional and framework-independent.

### `Injectable(dependencies)`

Associates dependency tokens with a class.

```typescript
import { Container, Injectable } from 'container-di';

const LoggerToken = Symbol('Logger');

@Injectable([LoggerToken])
class Service {
    constructor(readonly logger: unknown) {}
}

const container = Container.make();

container.instance(LoggerToken, console);
container.bind(Service);
```

### `Inject(token, options?)`

Associates a token with a specific constructor parameter.

```typescript
import { Inject } from 'container-di';

const LoggerToken = Symbol('Logger');

class Service {
    constructor(@Inject(LoggerToken) readonly logger: unknown) {}
}
```

`Inject(token, { optional: true })` marks the dependency optional.

### TypeScript Decorator Configuration

Decorator syntax requires TypeScript decorator support in the consuming application. If you also want `design:paramtypes`, enable metadata emission and load a metadata polyfill before decorated classes are evaluated.

```json
{
    "compilerOptions": {
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
    }
}
```

```typescript
import 'reflect-metadata';
```

The container never imports `reflect-metadata` for you. This keeps the runtime dependency-free and lets applications decide whether metadata reflection belongs in their bundle.

### Reflected Metadata Limits

Reflected `design:paramtypes` metadata cannot represent interfaces, generics, unions, or structural object types. It often reports broad constructors such as `Object`, `String`, `Number`, `Boolean`, or `Array`. The container treats those as ambiguous unless you explicitly register them, and it asks you to provide explicit tokens instead.

```typescript
interface Logger {}

class Service {
    constructor(readonly logger: Logger) {}
}

// Reflected metadata is likely Object, not Logger.
// Use container.inject(Service, [LoggerToken]) instead.
```

## Optional Dependencies

Use `optional(token)` when a missing dependency is allowed.

```typescript
import { Container, optional } from 'container-di';

const MetricsToken = Symbol('Metrics');

class WorkerService {
    constructor(readonly metrics?: unknown) {}
}

const container = Container.make();

container.inject(WorkerService, [optional(MetricsToken)]);
container.bind(WorkerService);

const service = container.get(WorkerService);

console.log(service.metrics); // undefined
```

Only missing optional dependencies become `undefined`. If a token is registered and fails while resolving, the failure is still thrown. This prevents optional dependencies from hiding broken registrations.

## Contextual Bindings

Contextual bindings let different consumers receive different dependencies for the same token.

```typescript
interface Logger {
    channel: string;
}

const LoggerToken = Symbol('Logger');

class ConsoleLogger implements Logger {
    readonly channel = 'console';
}

class FileLogger implements Logger {
    readonly channel = 'file';
}

class CliCommand {
    constructor(readonly logger: Logger) {}
}

class ImportJob {
    constructor(readonly logger: Logger) {}
}

container.inject(CliCommand, [LoggerToken]);
container.inject(ImportJob, [LoggerToken]);

container.when(CliCommand).needs(LoggerToken).giveClass(ConsoleLogger);
container.when(ImportJob).needs(LoggerToken).giveClass(FileLogger);

container.bind(CliCommand);
container.bind(ImportJob);
```

### Context Matching

Contextual bindings are checked while constructor parameters are resolved. Matching happens by implementation class first and owner registration token second.

```typescript
class Consumer {
    constructor(readonly logger: unknown) {}
}

const LoggerToken = Symbol('Logger');
const consumerToken = 'consumer';

container.inject(Consumer, [LoggerToken]);
container.when(consumerToken).needs(LoggerToken).giveValue(console);
container.bind(consumerToken, Consumer);

const consumer = container.get<Consumer>(consumerToken);
```

### Contextual Helper Methods

| API | Behavior |
|---|---|
| `give(valueOrClassOrFactory)` | Class constructors become transient class bindings, non-class functions become factories, and other inputs become values. |
| `giveClass(Class)` | Explicit contextual transient class binding. |
| `giveFactory(callback)` | Explicit contextual transient factory. |
| `giveValue(value)` | Explicit contextual value. |
| `giveToken(targetToken)` | Forward the dependency token to another token. |

Use the explicit helper when a value could be ambiguous. For example, use `giveValue(fn)` to inject a function as a value, and use `giveToken(symbolToken)` to forward to a symbol token.

Contextual class and factory bindings are transient. To reuse a singleton in a context, register it globally and forward to it:

```typescript
container.singleton(FileLogger);
container.when(ImportJob).needs(LoggerToken).giveToken(FileLogger);
```

## Circular Dependencies

The container tracks active resolution tokens and throws `ContainerException` when it detects a cycle.

```typescript
class A {
    constructor(readonly b: B) {}
}

class B {
    constructor(readonly a: A) {}
}

container.inject(A, [B]);
container.inject(B, [A]);
container.bind(A);
container.bind(B);

container.get(A); // throws: Circular dependency detected: A -> B -> A
```

Cycle detection covers:

- Direct class cycles.
- Indirect class cycles.
- Alias cycles.
- Factory cycles where factories call back into `get()`.
- Contextual binding cycles.

The resolution stack is cleaned up after successful resolutions and after thrown errors, so one failed resolution does not poison later independent resolutions.

## Error Handling

The public error classes are:

| Error | Meaning |
|---|---|
| `NotFoundException` | A requested top-level entry is not registered. |
| `ContainerException` | A registered entry exists but cannot be resolved, metadata is missing or ambiguous, a factory fails, a registration is invalid, or a circular dependency is detected. |

```typescript
import { Container, ContainerException, NotFoundException } from 'container-di';

const container = Container.make();

try {
    container.get('service');
} catch (error) {
    if (error instanceof NotFoundException) {
        console.log('The requested entry is not registered');
    } else if (error instanceof ContainerException) {
        console.log(error.message);
    }
}
```

Factory failures preserve the original thrown value as `cause` where practical through the container's `cause` property.

```typescript
container.factory('broken', () => {
    throw new Error('factory exploded');
});

try {
    container.get('broken');
} catch (error) {
    if (error instanceof ContainerException) {
        console.log(error.cause);
    }
}
```

## Cloudflare Workers

The container itself is Worker-safe:

- No Node-only runtime imports.
- No request or response APIs.
- No filesystem, network, process, or environment access.
- No background promises.
- No module-level request state.
- No dependency on `nodejs_compat`.

Use a container per request when storing request-scoped values:

```typescript
import { Container } from 'container-di';

interface Env {
    API_BASE_URL: string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const container = Container.make();

        container.instance('request', request);
        container.instance('env', env);
        container.factory('url', (currentContainer) => new URL(currentContainer.get<Request>('request').url));

        const url = container.get<URL>('url');

        return Response.json({ path: url.pathname });
    },
};
```

Module-level containers are acceptable for immutable application-wide registrations, but avoid putting request-specific data in module-level singletons because Workers may reuse isolates across requests.

```typescript
class AppConfig {
    constructor(readonly mode: string) {}
}

const app = Container.make();

app.singleton(AppConfig, () => new AppConfig('production'));

export default {
    async fetch(): Promise<Response> {
        const config = app.get(AppConfig);

        return Response.json({ mode: config.mode });
    },
};
```

If your own services or dependencies use Node.js APIs, your Worker may still need `nodejs_compat`. The container itself does not.

## TypeScript Notes

### TypeScript 6 Compatibility

The package is validated with TypeScript 6.x. The `types` package entry points at the root declaration file:

```json
{
    "types": "dist/container-di.d.ts",
    "exports": {
        ".": {
            "types": "./dist/container-di.d.ts",
            "import": "./dist/container-di.js",
            "require": "./dist/container-di.umd.cjs"
        }
    }
}
```

### Constructor Types

The exported constructor types are:

```typescript
type AbstractConstructor<T = unknown> = abstract new (...args: never[]) => T;
type Constructor<T = unknown> = new (...args: never[]) => T;
```

`bind()`, `singleton()`, `transient()`, and contextual class bindings require ES class constructors. Function constructors are not treated as class bindings.

### Type Inference

Class tokens preserve useful type inference:

```typescript
class Service {}

container.bind(Service);

const service = container.get(Service); // Service
```

String and symbol tokens often need either a typed token variable or an explicit `get<T>()` generic:

```typescript
const ConfigToken: Token<{ debug: boolean }> = Symbol('Config');

container.instance(ConfigToken, { debug: true });
const config = container.get(ConfigToken);
```

```typescript
const config = container.get<{ debug: boolean }>('config');
```

## Package Output

The package exposes:

| Field | Path |
|---|---|
| ESM import | `dist/container-di.js` |
| CommonJS require | `dist/container-di.umd.cjs` |
| Type declarations | `dist/container-di.d.ts` |

The package is marked with `sideEffects: false` so bundlers can tree-shake unused exports more effectively.

The npm package includes only the files configured by `package.json`:

- `LICENSE`;
- `README.md`;
- `dist/container-di.d.ts`;
- `dist/container-di.js`;
- `dist/container-di.umd.cjs`;
- `package.json`.

## API Reference

### Types

```typescript
type AbstractConstructor<T = unknown> = abstract new (...args: never[]) => T;
type Constructor<T = unknown> = new (...args: never[]) => T;
type Token<T = unknown> = string | symbol | AbstractConstructor<T>;
type Factory<T = unknown> = (container: ContainerInterface) => T;
type Lifetime = 'singleton' | 'transient' | 'instance';
type Dependency<T = unknown> = Token<T> | DependencyDescriptor<T>;
type DependencyDescriptor<T = unknown> = { token: Token<T>; optional: boolean };
type InjectOptions = { optional?: boolean };
type ClassOrFactory<T> = Constructor<T> | Factory<T>;
type ContextualGive<T> = T | Constructor<T> | Factory<T>;
```

### Container Creation

```typescript
Container.make(): ContainerInterface
```

### Access Methods

```typescript
container.get<T = unknown>(id: Token<T>): T
container.has(id: Token<unknown>): boolean
container.isRegistered(id: Token<unknown>): boolean
```

### Registration Methods

```typescript
container.set<T>(id: Token<T>, value: T | Factory<T>): void
container.bind<T>(id: Token<T>, implementation?: Constructor<T>): this
container.singleton<T>(id: Token<T>, implementation?: ClassOrFactory<T>): this
container.transient<T>(id: Token<T>, implementation?: ClassOrFactory<T>): this
container.instance<T>(id: Token<T>, value: T): this
container.factory<T>(id: Token<T>, factory: Factory<T>): this
container.alias<T>(id: Token<T>, target: Token<T>): this
```

### Autowiring Methods

```typescript
container.inject<T>(implementation: Constructor<T>, dependencies: ReadonlyArray<Dependency>): this
optional<T>(token: Token<T>): DependencyDescriptor<T>
Injectable(dependencies?: ReadonlyArray<Dependency>): ClassDecorator
Inject<T>(token: Token<T>, options?: InjectOptions): ParameterDecorator
```

### Contextual Binding Methods

```typescript
container.when(context).needs(token).give(valueOrClassOrFactory)
container.when(context).needs(token).giveClass(Class)
container.when(context).needs(token).giveFactory(callback)
container.when(context).needs(token).giveValue(value)
container.when(context).needs(token).giveToken(targetToken)
```

### Exceptions

```typescript
class ContainerException extends Error {
    readonly cause?: unknown;
}

class NotFoundException extends Error {}
```

## Migration Notes

### From a Simple Key/Value Container

Existing `set()` / `get()` usage continues to work:

```typescript
container.set('name', 'api');
container.get('name');
```

For clearer lifetime semantics, prefer the new registration API:

```typescript
container.instance('name', 'api');
container.singleton(Service);
container.factory('request.id', () => crypto.randomUUID());
```

### Callable `set()` Values

`set(token, function)` still invokes the function immediately and stores the result. If you intended to store the function itself, switch to `instance()`.

```typescript
container.instance('formatter', (value: string) => value.trim());
```

### Service Locator Warning

Factories receive the container for composition, but application services should usually receive their dependencies directly through constructors. Passing the container itself into business objects recreates the service locator pattern and makes dependencies harder to see and test.

Prefer this:

```typescript
class Service {
    constructor(readonly logger: Logger) {}
}
```

Over this:

```typescript
class Service {
    constructor(readonly container: ContainerInterface) {}
}
```

## Troubleshooting

### `NotFoundException: Container entry "x" was not found`

The token is not registered globally. Register it with `instance()`, `bind()`, `singleton()`, `factory()`, or `alias()`.

### `Cannot infer dependency #0`

The class has a constructor parameter but the container cannot infer a token. Add explicit metadata:

```typescript
container.inject(Service, [DependencyToken]);
```

### Reflected Dependency Is `Object`

This usually means TypeScript erased an interface or object-shaped type. Use a symbol token and explicit metadata.

### A Function Was Called During Registration

You probably used `set(token, fn)`. Use `instance(token, fn)` to store a function as a value, or `factory(token, fn)` to run it per resolution.

### `has(alias)` Is `false` but `isRegistered(alias)` Is `true`

The alias is registered, but its target is missing or cyclic. `isRegistered()` checks direct registration. `has()` checks whether the token is currently resolvable.

### Contextual Binding Does Not Affect `get(token)`

Contextual bindings apply only while resolving constructor dependencies for a matching consumer. They do not replace global bindings for top-level `get(token)` calls.

### Circular Dependency Detected

The error chain shows the cycle. Break the cycle by extracting a smaller dependency, using a factory boundary, or redesigning one service so it does not require the other during construction.

## Development

Install dependencies:

```bash
pnpm install
```

Run tests:

```bash
pnpm test
```

Build ESM, UMD/CJS, and declarations:

```bash
pnpm build
```

Run TypeScript and Biome checks:

```bash
pnpm lint
```

Run the Cloudflare Workers/package compatibility check:

```bash
pnpm check:workers
```

Inspect publish contents:

```bash
npm pack --dry-run
```

## License

MIT License

## Author

Roger Vilà &copy; 2026
