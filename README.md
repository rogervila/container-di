# Container DI

A lightweight Dependency Injection (DI) container library for TypeScript with singleton support.

## What's New in v2

Version 2 introduces a simplified architecture with a focus on the **singleton pattern**:

### Breaking Changes from v1

| v1 | v2 |
|---|---|
| Multiple storage containers (`InMemoryContainer`, `SessionStorageContainer`, `LocalStorageContainer`) | Single `Container` class |
| Functions stored as-is | Functions are automatically invoked and require a container instance as unique parameter |

### Singleton Pattern

In v2, when you set a **callable** value (a function), the container automatically invokes it and stores the **result**. This means:

- The function runs **once** at registration time
- Subsequent `get()` calls return the **same instance**
- The container itself is passed to the function, enabling dependency injection

This pattern ensures services are instantiated only once, providing consistent behavior across your application.

## Quick Start

```typescript
import { Container, ContainerInterface } from 'container-di';

const container = Container.make();

// Store values
container.set('config', { apiUrl: 'https://api.example.com' });

// Retrieve values
const config = container.get('config');
console.log(config.apiUrl); // 'https://api.example.com'

// Store singletons
class Service {
    constructor(private url: string) {}
}

container.set('service', (c: ContainerInterface) => new Service(c.get('config').apiUrl));

// Returns the same instance every time
const service = container.get('service');
const service2 = container.get('service');

console.log(service === service2); // true
```

## Usage Examples

### Non-Callable Values

Non-callable values (primitives, objects, arrays) are stored as-is.

#### Using `set()` and `get()` methods

```typescript
import { Container } from 'container-di';

const container = Container.make();

// Primitives
container.set('name', 'John Doe');
container.set('count', 42);
container.set('active', true);

console.log(container.get('name'));   // 'John Doe'
console.log(container.get('count'));  // 42
console.log(container.get('active')); // true

// Objects and Arrays
container.set('user', { id: 1, name: 'Jane' });
container.set('numbers', [1, 2, 3]);

console.log(container.get('user'));    // { id: 1, name: 'Jane' }
console.log(container.get('numbers')); // [1, 2, 3]
```

#### Using Proxy Access

The container supports bracket notation for a more natural syntax:

```typescript
import { Container } from 'container-di';

const container = Container.make();

// Set via proxy
container['apiKey'] = 'secret-key-123';
container['settings'] = { theme: 'dark', language: 'en' };

// Get via proxy
console.log(container['apiKey']);   // 'secret-key-123'
console.log(container['settings']); // { theme: 'dark', language: 'en' }
```

### Callable Values (Singleton Pattern)

When you pass a function, it's invoked immediately with the container as an argument. The **result** is stored, not the function itself.

#### Using `set()` and `get()` methods

```typescript
import { Container, ContainerInterface } from 'container-di';

const container = Container.make();

// Define a service class
class DatabaseService {
    constructor(private connectionString: string) {}

    connect(): string {
        return `Connected to ${this.connectionString}`;
    }
}

// Register dependencies
container.set('dbConnection', 'postgresql://localhost:5432/mydb');

// Register a service factory (singleton)
container.set('database', (c: ContainerInterface) => {
    return new DatabaseService(c.get('dbConnection'));
});

// Get the service - returns the same instance every time
const db1 = container.get<DatabaseService>('database');
const db2 = container.get<DatabaseService>('database');

console.log(db1 === db2);        // true (same instance!)
console.log(db1.connect());      // 'Connected to postgresql://localhost:5432/mydb'
```

#### Using Proxy Access

The same singleton behavior works with proxy syntax:

```typescript
import { Container, ContainerInterface } from 'container-di';

const container = Container.make();

class AuthService {
    constructor(private token: string) {}

    getToken(): string {
        return this.token;
    }
}

// Set via proxy
container['secretToken'] = 'my-secret-token';
container['auth'] = (c: ContainerInterface) => new AuthService(c.get('secretToken'));

// Get via proxy - same singleton behavior
const auth1 = container['auth'];
const auth2 = container['auth'];

console.log(auth1 === auth2);       // true (same instance!)
console.log(auth1.getToken());      // 'my-secret-token'
```

### Summary: Proxy vs Non-Proxy

| Method | Set | Get | Singleton Support |
|--------|-----|-----|-------------------|
| **Non-Proxy** | `container.set('key', value)` | `container.get('key')` | ✅ |
| **Proxy** | `container['key'] = value` | `container['key']` | ✅ |

Both methods support the singleton pattern - the key difference is syntactic preference.

## Error Handling

```typescript
import { Container, NotFoundException, ContainerException } from 'container-di';

const container = Container.make();

try {
    container.get('nonexistent');
} catch (error) {
    if (error instanceof NotFoundException) {
        console.log('Item not found in container');
    } else if (error instanceof ContainerException) {
        console.log('General container error');
    }
}
```

### Exception Types

| Exception | Description |
|-----------|-------------|
| `NotFoundException` | Thrown when requesting an item that doesn't exist |
| `ContainerException` | General container errors (e.g., storage issues) |

## API Reference

### `Container.make()`

Creates a new container instance with proxy support.

```typescript
const container = Container.make();
```

### `container.set<T>(id: string, value: T | (c: ContainerInterface) => T): void`

Stores a value in the container. If the value is a function, it's invoked with the container and the result is stored (singleton pattern).

### `container.get<T>(id: string): T`

Retrieves a value from the container. Throws `NotFoundException` if the item doesn't exist.

### `container.has(id: string): boolean`

Checks if an item exists in the container.

## License

MIT License

## Author

Roger Vilà &copy; 2025
