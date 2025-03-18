/**
 * @package container-di
 * @license MIT
 * @copyright Roger Vilà 2025
 */

/**
 * @see https://www.php-fig.org/psr/psr-11/#32-psrcontainercontainerexceptioninterface
 */
export type ContainerExceptionInterface = Error;
export class ContainerException extends Error implements ContainerExceptionInterface {}

/**
 * @see https://www.php-fig.org/psr/psr-11/#33-psrcontainernotfoundexceptioninterface
 */
export type NotFoundExceptionInterface = Error;
export class NotFoundException extends Error implements NotFoundExceptionInterface {}

/**
 * @see https://www.php-fig.org/psr/psr-11/#31-psrcontainercontainerinterface
 */
export interface ContainerInterface {
    /**
     * @throws NotFoundExceptionInterface
     * @throws ContainerExceptionInterface
     */
    get<T>(id: string): T;

    has(id: string): boolean;

    set<T>(id: string, value: T): void;
}

class ContainerProxy {
    [id: string]: any;

    static make<T extends ContainerInterface>(this: new () => T): T {
        return new Proxy(new this(), {
            get<T>(target: any, prop: any): T {
                if (prop in target) {
                    return target[prop];
                }
                return target.get(prop);
            },
            set<T>(target: any, prop: any, value: T): boolean {
                target.set(prop, value);
                return true;
            },
        });
    }
}

export class InMemoryContainer extends ContainerProxy implements ContainerInterface {
    private items: Map<string, any> = new Map<string, any>();

    get<T>(id: string): T {
        if (!this.has(id)) {
            throw new NotFoundException();
        }

        try {
            return this.items.get(id);
        } catch (e) {
            throw new ContainerException((e as Error).message);
        }
    }

    has(id: string): boolean {
        return this.items.has(id);
    }

    set<T>(id: string, value: T): void {
        this.items.set(id, value);
    }
}

export class SessionStorageContainer extends ContainerProxy implements ContainerInterface {
    constructor() {
        super();
        if (!sessionStorage) {
            throw new ContainerException('Session storage is not available');
        }
    }

    get<T>(id: string): T {
        if (!this.has(id)) {
            throw new NotFoundException();
        }

        const item = sessionStorage.getItem(id);

        if (!item) {
            throw new ContainerException();
        }

        try {
            if (item.startsWith('return (')) {
                return new Function(item)();
            }

            return JSON.parse(item);
        } catch (e) {
            throw new ContainerException((e as Error).message);
        }
    }

    has(id: string): boolean {
        return !!sessionStorage.getItem(id);
    }

    set<T>(id: string, value: T): void {
        const storedValue = value instanceof Function ? `return (${value.toString()})` : JSON.stringify(value);
        sessionStorage.setItem(id, storedValue);
    }
}

export class LocalStorageContainer extends ContainerProxy implements ContainerInterface {
    constructor() {
        super();
        if (!localStorage) {
            throw new ContainerException('Local storage is not available');
        }
    }

    get<T>(id: string): T {
        if (!this.has(id)) {
            throw new NotFoundException();
        }

        const item = localStorage.getItem(id);

        if (!item) {
            throw new ContainerException();
        }

        try {
            if (item.startsWith('return (')) {
                return new Function(item)();
            }

            return JSON.parse(item);
        } catch (e) {
            throw new ContainerException((e as Error).message);
        }
    }

    has(id: string): boolean {
        return !!localStorage.getItem(id);
    }

    set<T>(id: string, value: T): void {
        const storedValue = value instanceof Function ? `return (${value.toString()})` : JSON.stringify(value);

        localStorage.setItem(id, storedValue);
    }
}
