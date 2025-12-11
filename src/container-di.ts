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

    set<T>(id: string, value: T | ((c: ContainerInterface) => T)): void;
}

class ContainerProxy {
    [id: string]: any;

    static make<T extends ContainerInterface>(this: new () => T): T {
        return new Proxy(new this(), {
            get<T>(target: any, prop: string): T {
                let value: T | undefined;

                if (prop in target) {
                    value = target[prop];
                } else {
                    value = target.get(prop);
                }

                if (value === undefined) {
                    throw new NotFoundException();
                }

                return value;
            },
            set<T>(target: any, prop: any, value: T | ((c: ContainerInterface) => T)): boolean {
                // Singleton
                if (typeof value === 'function') {
                    target.set(prop, (value as (c: ContainerInterface) => T)(target));
                } else {
                    target.set(prop, value);
                }
                return true;
            },
        });
    }
}

export class Container extends ContainerProxy implements ContainerInterface {
    private items: Map<string, any> = new Map<string, any>();

    get<T>(id: string): T {
        if (!this.has(id)) {
            throw new NotFoundException();
        }

        try {
            const item: T | undefined = this.items.get(id);

            if (item === undefined) {
                throw new NotFoundException();
            }

            return item;
        } catch (e) {
            throw new ContainerException((e as Error).message);
        }
    }

    has(id: string): boolean {
        return this.items.has(id);
    }

    set<T>(id: string, value: T | ((c: ContainerInterface) => T)): void {
        // Singleton
        if (typeof value === 'function') {
            this.items.set(id, (value as (c: ContainerInterface) => T)(this));
            return;
        }

        this.items.set(id, value);
    }
}
