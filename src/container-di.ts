/**
 * @package container-di
 * @license MIT
 * @copyright Roger Vilà 2026
 */

/**
 * @see https://www.php-fig.org/psr/psr-11/#32-psrcontainercontainerexceptioninterface
 */
export interface ContainerExceptionInterface extends Error {}

export class ContainerException extends Error implements ContainerExceptionInterface {
    readonly cause?: unknown;

    constructor(message: string = 'Container error', options?: { cause?: unknown }) {
        super(message);
        this.name = 'ContainerException';
        this.cause = options?.cause;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * @see https://www.php-fig.org/psr/psr-11/#33-psrcontainernotfoundexceptioninterface
 */
export interface NotFoundExceptionInterface extends ContainerExceptionInterface {}

export class NotFoundException extends Error implements NotFoundExceptionInterface {
    constructor(id?: Token<unknown>) {
        super(
            id === undefined ? 'Container entry was not found' : `Container entry ${describeToken(id)} was not found`,
        );
        this.name = 'NotFoundException';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export type AbstractConstructor<T = unknown> = abstract new (...args: never[]) => T;
export type Constructor<T = unknown> = new (...args: never[]) => T;
export type Token<T = unknown> = string | symbol | AbstractConstructor<T>;
export type Factory<T = unknown> = (container: ContainerInterface) => T;
export type Lifetime = 'singleton' | 'transient' | 'instance';
export type Dependency<T = unknown> = Token<T> | DependencyDescriptor<T>;

export type DependencyDescriptor<T = unknown> = {
    token: Token<T>;
    optional: boolean;
};

export type InjectOptions = {
    optional?: boolean;
};

export type ClassOrFactory<T> = Constructor<T> | Factory<T>;
export type ContextualGive<T> = T | Constructor<T> | Factory<T>;
type DependencySource = 'explicit' | 'reflect';
type ResolvedDependency = DependencyDescriptor & {
    source: DependencySource;
};

type ReflectWithMetadata = typeof Reflect & {
    getMetadata?: (metadataKey: string, target: object) => unknown;
};

type ValueBinding<T> = {
    kind: 'value';
    lifetime: 'instance';
    value: T;
};

type ClassBinding<T> = {
    kind: 'class';
    lifetime: 'singleton' | 'transient';
    implementation: Constructor<T>;
    cached: T | undefined;
    hasCached: boolean;
};

type FactoryBinding<T> = {
    kind: 'factory';
    lifetime: 'singleton' | 'transient';
    factory: Factory<T>;
    cached: T | undefined;
    hasCached: boolean;
};

type AliasBinding<T> = {
    kind: 'alias';
    target: Token<T>;
};

type Binding<T = unknown> = ValueBinding<T> | ClassBinding<T> | FactoryBinding<T> | AliasBinding<T>;

const classDependencyMetadata = new WeakMap<object, Array<DependencyDescriptor>>();
const parameterDependencyMetadata = new WeakMap<object, Map<number, DependencyDescriptor>>();
const constructorCheckCache = new WeakMap<Function, boolean>();

export interface ContextualBindingBuilder {
    needs<T>(id: Token<T>): ContextualBindingNeedsBuilder<T>;
}

export interface ContextualBindingNeedsBuilder<T> {
    give(implementation: ContextualGive<T>): ContainerInterface;

    giveClass(implementation: Constructor<T>): ContainerInterface;

    giveFactory(factory: Factory<T>): ContainerInterface;

    giveValue(value: T): ContainerInterface;

    giveToken(target: Token<T>): ContainerInterface;
}

/**
 * @see https://www.php-fig.org/psr/psr-11/#31-psrcontainercontainerinterface
 */
export interface ContainerInterface {
    /**
     * @throws NotFoundExceptionInterface
     * @throws ContainerExceptionInterface
     */
    get<T = unknown>(id: Token<T>): T;

    has(id: Token<unknown>): boolean;

    set<T>(id: Token<T>, value: T | Factory<T>): void;

    bind<T>(id: Token<T>, implementation?: Constructor<T>): this;

    singleton<T>(id: Token<T>, implementation?: ClassOrFactory<T>): this;

    transient<T>(id: Token<T>, implementation?: ClassOrFactory<T>): this;

    instance<T>(id: Token<T>, value: T): this;

    factory<T>(id: Token<T>, factory: Factory<T>): this;

    alias<T>(id: Token<T>, target: Token<T>): this;

    when(context: Token<unknown>): ContextualBindingBuilder;

    isRegistered(id: Token<unknown>): boolean;

    inject<T>(implementation: Constructor<T>, dependencies: ReadonlyArray<Dependency>): this;
}

export function optional<T>(token: Token<T>): DependencyDescriptor<T> {
    return { token, optional: true };
}

export function Injectable(dependencies: ReadonlyArray<Dependency> = []): ClassDecorator {
    return (target) => {
        classDependencyMetadata.set(target, normalizeDependencies(dependencies));
    };
}

export function Inject<T>(token: Token<T>, options: InjectOptions = {}): ParameterDecorator {
    return (target, _propertyKey, parameterIndex) => {
        const targetConstructor = typeof target === 'function' ? target : target.constructor;
        const dependencies =
            parameterDependencyMetadata.get(targetConstructor) ?? new Map<number, DependencyDescriptor>();

        dependencies.set(parameterIndex, { token, optional: options.optional === true });
        parameterDependencyMetadata.set(targetConstructor, dependencies);
    };
}

function describeToken(id: Token<unknown>): string {
    if (typeof id === 'string') {
        return `"${id}"`;
    }

    if (typeof id === 'symbol') {
        return id.toString();
    }

    return id.name || '<anonymous constructor>';
}

function isConstructor(value: unknown): value is Constructor<unknown> {
    if (typeof value !== 'function') {
        return false;
    }

    const cached = constructorCheckCache.get(value);

    if (cached !== undefined) {
        return cached;
    }

    const result = Function.prototype.toString.call(value).startsWith('class ');

    constructorCheckCache.set(value, result);

    return result;
}

function isDependencyDescriptor(value: unknown): value is DependencyDescriptor {
    return typeof value === 'object' && value !== null && 'token' in value && 'optional' in value;
}

function normalizeDependency(dependency: Dependency): DependencyDescriptor {
    if (isDependencyDescriptor(dependency)) {
        return {
            token: dependency.token,
            optional: dependency.optional === true,
        };
    }

    return {
        token: dependency,
        optional: false,
    };
}

function normalizeDependencies(dependencies: ReadonlyArray<Dependency>): Array<DependencyDescriptor> {
    return dependencies.map((dependency) => normalizeDependency(dependency));
}

function getHighestParameterIndex(dependencies: Map<number, DependencyDescriptor> | undefined): number {
    if (dependencies === undefined || dependencies.size === 0) {
        return -1;
    }

    let highestIndex = -1;

    for (const index of dependencies.keys()) {
        if (index > highestIndex) {
            highestIndex = index;
        }
    }

    return highestIndex;
}

function getReflectedParamTypes(implementation: Constructor<unknown>): Array<Token<unknown>> {
    const getMetadata = (Reflect as ReflectWithMetadata).getMetadata;
    const metadata = getMetadata?.('design:paramtypes', implementation);

    return Array.isArray(metadata) ? (metadata as Array<Token<unknown>>) : [];
}

function isAmbiguousReflectedToken(token: Token<unknown>): boolean {
    return token === Object || token === String || token === Number || token === Boolean || token === Array;
}

function createClassBinding<T>(implementation: Constructor<T>, lifetime: 'singleton' | 'transient'): ClassBinding<T> {
    return {
        kind: 'class',
        lifetime,
        implementation,
        cached: undefined,
        hasCached: false,
    };
}

function createFactoryBinding<T>(factory: Factory<T>, lifetime: 'singleton' | 'transient'): FactoryBinding<T> {
    return {
        kind: 'factory',
        lifetime,
        factory,
        cached: undefined,
        hasCached: false,
    };
}

class ContainerProxy {
    [id: string]: unknown;

    static make<T extends ContainerInterface>(this: new () => T): T {
        return new Proxy(new this(), {
            get(target: T, prop: string | symbol, receiver: unknown): unknown {
                if (prop in target) {
                    return Reflect.get(target, prop, receiver);
                }

                if (typeof prop === 'string') {
                    return target.get(prop);
                }

                return target.has(prop) ? target.get(prop) : undefined;
            },
            set(target: T, prop: string | symbol, value: unknown): boolean {
                target.set(prop, value);
                return true;
            },
        });
    }
}

export class Container extends ContainerProxy implements ContainerInterface {
    private bindings = new Map<Token<unknown>, Binding>();
    private contextualBindings = new Map<Token<unknown>, Map<Token<unknown>, Binding>>();
    private dependencyMetadata = new WeakMap<Constructor<unknown>, Array<DependencyDescriptor>>();
    private resolutionSet = new Set<Token<unknown>>();
    private resolutionStack: Array<Token<unknown>> = [];

    get<T = unknown>(id: Token<T>): T {
        return this.resolve(id);
    }

    has(id: Token<unknown>): boolean {
        return this.canResolve(id, new Set<Token<unknown>>());
    }

    set<T>(id: Token<T>, value: T | Factory<T>): void {
        // Singleton
        if (typeof value === 'function') {
            this.instance(id, this.invokeFactory(id, value as Factory<T>));
            return;
        }

        this.instance(id, value);
    }

    bind<T>(id: Token<T>, implementation?: Constructor<T>): this {
        const buildable = implementation ?? this.defaultImplementation(id);

        if (!isConstructor(buildable)) {
            throw new ContainerException(`Binding for ${describeToken(id)} must be a class constructor`);
        }

        this.bindings.set(id, createClassBinding(buildable, 'transient'));

        return this;
    }

    singleton<T>(id: Token<T>, implementation?: ClassOrFactory<T>): this {
        return this.registerBuildable(id, implementation, 'singleton');
    }

    transient<T>(id: Token<T>, implementation?: ClassOrFactory<T>): this {
        return this.registerBuildable(id, implementation, 'transient');
    }

    instance<T>(id: Token<T>, value: T): this {
        this.bindings.set(id, {
            kind: 'value',
            lifetime: 'instance',
            value,
        });

        return this;
    }

    factory<T>(id: Token<T>, factory: Factory<T>): this {
        if (isConstructor(factory)) {
            throw new ContainerException(
                `Factory for ${describeToken(id)} must be a function, not a class constructor`,
            );
        }

        this.bindings.set(id, createFactoryBinding(factory, 'transient'));

        return this;
    }

    alias<T>(id: Token<T>, target: Token<T>): this {
        this.bindings.set(id, {
            kind: 'alias',
            target,
        });

        return this;
    }

    when(context: Token<unknown>): ContextualBindingBuilder {
        return {
            needs: <T>(id: Token<T>): ContextualBindingNeedsBuilder<T> => ({
                give: (implementation: ContextualGive<T>): ContainerInterface =>
                    this.addContextualBinding(context, id, this.createContextualBinding(id, implementation)),
                giveClass: (implementation: Constructor<T>): ContainerInterface =>
                    this.addContextualBinding(context, id, createClassBinding(implementation, 'transient')),
                giveFactory: (factory: Factory<T>): ContainerInterface =>
                    this.addContextualBinding(context, id, this.createFactoryContextualBinding(id, factory)),
                giveValue: (value: T): ContainerInterface =>
                    this.addContextualBinding(context, id, {
                        kind: 'value',
                        lifetime: 'instance',
                        value,
                    }),
                giveToken: (target: Token<T>): ContainerInterface =>
                    this.addContextualBinding(context, id, {
                        kind: 'alias',
                        target,
                    }),
            }),
        };
    }

    isRegistered(id: Token<unknown>): boolean {
        return this.bindings.has(id);
    }

    inject<T>(implementation: Constructor<T>, dependencies: ReadonlyArray<Dependency>): this {
        this.dependencyMetadata.set(implementation, normalizeDependencies(dependencies));

        return this;
    }

    private registerBuildable<T>(
        id: Token<T>,
        implementation: ClassOrFactory<T> | undefined,
        lifetime: 'singleton' | 'transient',
    ): this {
        const buildable = implementation ?? this.defaultImplementation(id);

        if (isConstructor(buildable)) {
            this.bindings.set(id, createClassBinding(buildable, lifetime));
            return this;
        }

        if (typeof buildable === 'function') {
            this.bindings.set(id, createFactoryBinding(buildable, lifetime));
            return this;
        }

        throw new ContainerException(`Registration for ${describeToken(id)} must be a class constructor or factory`);
    }

    private defaultImplementation<T>(id: Token<T>): Constructor<T> {
        if (isConstructor(id)) {
            return id as Constructor<T>;
        }

        throw new ContainerException(`Registration for ${describeToken(id)} requires an implementation`);
    }

    private resolve<T>(id: Token<T>): T {
        return this.withResolution(id, () => {
            const binding = this.bindings.get(id) as Binding<T> | undefined;

            if (binding === undefined) {
                throw new NotFoundException(id);
            }

            return this.resolveBinding(id, binding);
        });
    }

    private resolveBinding<T>(id: Token<T>, binding: Binding<T>): T {
        switch (binding.kind) {
            case 'value':
                return binding.value;
            case 'alias':
                return this.resolve(binding.target);
            case 'class':
                return this.resolveClassBinding(id, binding);
            case 'factory':
                return this.resolveFactoryBinding(id, binding);
        }
    }

    private resolveClassBinding<T>(id: Token<T>, binding: ClassBinding<T>): T {
        if (binding.lifetime === 'singleton' && binding.hasCached) {
            return binding.cached as T;
        }

        const instance = this.instantiate(id, binding.implementation);

        if (binding.lifetime === 'singleton') {
            binding.cached = instance;
            binding.hasCached = true;
        }

        return instance;
    }

    private resolveFactoryBinding<T>(id: Token<T>, binding: FactoryBinding<T>): T {
        if (binding.lifetime === 'singleton' && binding.hasCached) {
            return binding.cached as T;
        }

        const instance = this.invokeFactory(id, binding.factory);

        if (binding.lifetime === 'singleton') {
            binding.cached = instance;
            binding.hasCached = true;
        }

        return instance;
    }

    private instantiate<T>(id: Token<T>, implementation: Constructor<T>): T {
        try {
            const dependencies = this.resolveConstructorArguments(id, implementation);

            return new implementation(...(dependencies as never[]));
        } catch (error) {
            if (error instanceof ContainerException || error instanceof NotFoundException) {
                throw error;
            }

            throw new ContainerException(`Failed to instantiate ${describeToken(id)}`, { cause: error });
        }
    }

    private resolveConstructorArguments<T>(id: Token<T>, implementation: Constructor<T>): Array<unknown> {
        const dependencies = this.getConstructorDependencies(id, implementation);

        return dependencies.map((dependency, index) => this.resolveDependency(id, implementation, dependency, index));
    }

    private getConstructorDependencies<T>(id: Token<T>, implementation: Constructor<T>): Array<ResolvedDependency> {
        const localDependencies = this.dependencyMetadata.get(implementation as Constructor<unknown>);
        const parameterDependencies = parameterDependencyMetadata.get(implementation);
        const classDependencies = classDependencyMetadata.get(implementation);
        const reflectedDependencies = getReflectedParamTypes(implementation as Constructor<unknown>);
        const dependencyCount = Math.max(
            implementation.length,
            localDependencies?.length ?? 0,
            classDependencies?.length ?? 0,
            getHighestParameterIndex(parameterDependencies) + 1,
            reflectedDependencies.length,
        );

        if (dependencyCount === 0) {
            return [];
        }

        const dependencies: Array<ResolvedDependency> = [];

        for (let index = 0; index < dependencyCount; index += 1) {
            const explicitDependency =
                localDependencies?.[index] ?? parameterDependencies?.get(index) ?? classDependencies?.[index];

            if (explicitDependency !== undefined) {
                dependencies.push({ ...explicitDependency, source: 'explicit' });
                continue;
            }

            const reflectedDependency = reflectedDependencies[index];

            if (reflectedDependency === undefined) {
                throw new ContainerException(
                    `Cannot infer dependency #${index} for ${describeToken(id)}. Use inject(), Injectable([...]), or Inject(token) to provide an explicit token.`,
                );
            }

            dependencies.push({ token: reflectedDependency, optional: false, source: 'reflect' });
        }

        return dependencies;
    }

    private resolveDependency<T>(
        id: Token<T>,
        implementation: Constructor<T>,
        dependency: ResolvedDependency,
        index: number,
    ): unknown {
        const contextualBinding = this.getContextualBinding(id, implementation, dependency.token);

        if (contextualBinding !== undefined) {
            return this.withResolution(dependency.token, () =>
                this.resolveBinding(dependency.token, contextualBinding),
            );
        }

        if (
            dependency.source === 'reflect' &&
            isAmbiguousReflectedToken(dependency.token) &&
            !this.has(dependency.token)
        ) {
            throw new ContainerException(
                `Reflected dependency ${describeToken(dependency.token)} for ${describeToken(id)} parameter #${index} is ambiguous. Use inject(), Injectable([...]), or Inject(token) for interfaces, primitives, and erased types.`,
            );
        }

        if (this.isRegistered(dependency.token)) {
            return this.resolve(dependency.token);
        }

        if (isConstructor(dependency.token)) {
            return this.withResolution(dependency.token, () =>
                this.instantiate(dependency.token, dependency.token as Constructor<unknown>),
            );
        }

        if (dependency.optional) {
            return undefined;
        }

        throw new ContainerException(
            `Cannot resolve dependency ${describeToken(dependency.token)} for ${describeToken(id)} parameter #${index} of ${describeToken(implementation)}.`,
            { cause: new NotFoundException(dependency.token) },
        );
    }

    private addContextualBinding<T>(context: Token<unknown>, id: Token<T>, binding: Binding<T>): this {
        const bindings = this.contextualBindings.get(context) ?? new Map<Token<unknown>, Binding>();

        bindings.set(id, binding);
        this.contextualBindings.set(context, bindings);

        return this;
    }

    private createContextualBinding<T>(id: Token<T>, implementation: ContextualGive<T>): Binding<T> {
        if (isConstructor(implementation)) {
            return createClassBinding(implementation, 'transient');
        }

        if (typeof implementation === 'function') {
            return this.createFactoryContextualBinding(id, implementation as Factory<T>);
        }

        return {
            kind: 'value',
            lifetime: 'instance',
            value: implementation,
        };
    }

    private createFactoryContextualBinding<T>(id: Token<T>, factory: Factory<T>): FactoryBinding<T> {
        if (isConstructor(factory)) {
            throw new ContainerException(
                `Contextual factory for ${describeToken(id)} must be a function, not a class constructor`,
            );
        }

        return createFactoryBinding(factory, 'transient');
    }

    private getContextualBinding<T>(
        id: Token<unknown>,
        implementation: Constructor<unknown>,
        dependency: Token<T>,
    ): Binding<T> | undefined {
        const implementationBinding = this.contextualBindings.get(implementation)?.get(dependency) as
            | Binding<T>
            | undefined;

        return implementationBinding ?? (this.contextualBindings.get(id)?.get(dependency) as Binding<T> | undefined);
    }

    private withResolution<T>(id: Token<unknown>, callback: () => T): T {
        if (this.resolutionSet.has(id)) {
            throw new ContainerException(`Circular dependency detected: ${this.formatResolutionChain(id)}`);
        }

        this.resolutionSet.add(id);
        this.resolutionStack.push(id);

        try {
            return callback();
        } finally {
            this.resolutionStack.pop();
            this.resolutionSet.delete(id);
        }
    }

    private formatResolutionChain(id: Token<unknown>): string {
        return [...this.resolutionStack, id].map((token) => describeToken(token)).join(' -> ');
    }

    private invokeFactory<T>(id: Token<T>, factory: Factory<T>): T {
        try {
            return factory(this);
        } catch (error) {
            if (error instanceof ContainerException || error instanceof NotFoundException) {
                throw error;
            }

            throw new ContainerException(`Factory for ${describeToken(id)} failed`, { cause: error });
        }
    }

    private canResolve(id: Token<unknown>, seen: Set<Token<unknown>>): boolean {
        if (seen.has(id)) {
            return false;
        }

        const binding = this.bindings.get(id);

        if (binding === undefined) {
            return false;
        }

        if (binding.kind !== 'alias') {
            return true;
        }

        seen.add(id);

        return this.canResolve(binding.target, seen);
    }
}
