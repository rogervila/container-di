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

// Store a value
container.set('user', { name: 'John Doe' });

// Retrieve a value
const user = container.get('user');
console.log(user.name); // 'John Doe'
```

## Container Types

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
