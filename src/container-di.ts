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
    get(id: string): any;

    has(id: string): boolean;

    set(id: string, value: any): void;
}

class ContainerProxy {
    [id: string]: any;

    static make<T extends ContainerInterface>(this: new () => T): T {
        return new Proxy(new this(), {
            get(target, prop) {
                if (prop in target) {
                    // @ts-expect-error ts(7052) Access methods or properties of Foo
                    return target[prop];
                }
                // @ts-expect-error ts(7052) Redirect to the `get` method for custom properties
                return target.get(prop);
            },
            set(target, prop, value) {
                // @ts-expect-error ts(7052) Redirect to the `set` method for custom properties
                target.set(prop, value);
                return true;
            },
        });
    }
}

export class InMemoryContainer extends ContainerProxy implements ContainerInterface {
    private items: Map<string, any> = new Map<string, any>();

    get(id: string): any {
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

    set(id: string, value: any): void {
        this.items.set(id, value);
    }
}

export class SessionStorageContainer extends ContainerProxy implements ContainerInterface {
    get(id: string): any {
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

    set(id: string, value: any): void {
        const storedValue = value instanceof Function ? `return (${value.toString()})` : JSON.stringify(value);
        sessionStorage.setItem(id, storedValue);
    }
}

export class LocalStorageContainer extends ContainerProxy implements ContainerInterface {
    get(id: string): any {
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

    set(id: string, value: any): void {
        const storedValue = value instanceof Function ? `return (${value.toString()})` : JSON.stringify(value);

        localStorage.setItem(id, storedValue);
    }
}
