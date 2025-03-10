# Container DI

A lightweight Dependency Injection (DI) container library for TypeScript with flexible storage mechanisms.

## Features

- 🚀 Multiple Storage Containers:
  - In-memory storage
  - Browser session storage
  - Browser local storage

- 💡 Key Capabilities:
  - Store and retrieve values by identifiers
  - Support for primitives, objects, and functions
  - Typed exception handling
  - Proxy-based dynamic access

## Quick Start

```typescript
import { InMemoryContainer } from 'container-di';

const container = InMemoryContainer.make();

// Store values
container.set('user', { name: 'John Doe' });

// Retrieve values
const user = container.get('user');
console.log(user.name); // 'John Doe'

// Store functions
container['sum'] = (a: number, b: number) => a + b;

// Retrieve functions
const sum = container['sum'];
sum(1, 2); // 3
```

## Container Types

> ⚠️ Storage availability is checked at runtime. If the storage is not available, `ContainerException` will be thrown.

### InMemoryContainer
Runtime storage for temporary dependencies.

### SessionStorageContainer
Persistent storage within a browser session.

### LocalStorageContainer
Long-term storage across browser sessions.

## Error Handling

- `NotFoundException`: Item not found
- `ContainerException`: General container errors

## License

MIT License

## Author

Roger Vilà &copy; 2025
