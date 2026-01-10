# 🔌 Plugin System

Illuma provides a plugin system that allows you to extend its core functionality. The plugin system supports three types of plugins:

1. **Context Scanners** – Extend injection detection to support custom patterns
2. **Diagnostics Modules** – Analyze and report on container state after bootstrap
3. **Middlewares** – Intercept and modify instance creation

## Table of Contents

- [🔌 Plugin System](#-plugin-system)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Context Scanners](#context-scanners)
    - [What are Context Scanners?](#what-are-context-scanners)
    - [Context Scanner Interface](#context-scanner-interface)
  - [Diagnostics Modules](#diagnostics-modules)
    - [What are Diagnostics Modules?](#what-are-diagnostics-modules)
    - [Diagnostics Module Interface](#diagnostics-module-interface)
    - [Developing a Diagnostics Module](#developing-a-diagnostics-module)
      - [Example: Custom Performance Reporter](#example-custom-performance-reporter)
      - [Example: Unused Dependency Validator](#example-unused-dependency-validator)
      - [Example: JSON Diagnostics Logger](#example-json-diagnostics-logger)
    - [Registering a Diagnostics Module](#registering-a-diagnostics-module)
  - [Middlewares](#middlewares)
    - [What are Middlewares?](#what-are-middlewares)
    - [Middleware Interface](#middleware-interface)
    - [Developing a Middleware](#developing-a-middleware)
      - [Example: Logging Middleware](#example-logging-middleware)
      - [Example: Proxy Middleware](#example-proxy-middleware)
    - [Registering Middleware](#registering-middleware)
      - [Global Registration](#global-registration)
      - [Local Registration](#local-registration)
  - [Best Practices](#best-practices)
  - [Advanced Examples](#advanced-examples)
    - [Property Injection Scanner](#property-injection-scanner)
    - [Conditional Diagnostics Reporter](#conditional-diagnostics-reporter)
  - [Plugin Lifecycle](#plugin-lifecycle)
  - [Existing Plugins](#existing-plugins)
    - [@illuma/reflect - Injections via constructor metadata and property decorators](#illumareflect---injections-via-constructor-metadata-and-property-decorators)
  - [Next Steps](#next-steps)

---

## Overview

The `Illuma` class is the central hub for managing plugins in Illuma. It provides static methods to register plugins globally, which will then be automatically invoked at the appropriate times during the container lifecycle.

```typescript
import { Illuma } from '@illuma/core';

// Register a context scanner
Illuma.extendContextScanner(myScanner);

// Register a diagnostics module
Illuma.extendDiagnostics(myDiagnostics);

// Register a global middleware
Illuma.registerGlobalMiddleware(myMiddleware);
```

**Key characteristics:**
- Plugins are registered **globally** and affect all container instances
- Context scanners run during **detection** phase (before building dependency graph)
- Middlewares run during **instantiation** phase (when creating instances)
- Diagnostics modules run after each container bootstrap completes
- Multiple plugins can be registered and execute in registration order

> **Note:** Plugins must be registered **before** creating any container instances to ensure they are applied correctly. Execution order is not guaranteed due to potential imports of external packages via NPM.

---

## Context Scanners

### What are Context Scanners?

Context scanners are plugins that extend Illuma's ability to detect dependency injections. By default, Illuma detects dependencies through `nodeInject()` calls. Context scanners allow you to add support for:

- Custom decorators (e.g., `@CustomInject()`)
- Metadata-based injection patterns
- Property decorators
- Framework-specific injection patterns
- Alternative injection APIs

### Context Scanner Interface

A context scanner must implement the `iContextScanner` interface:

```typescript
import type { iInjectionNode } from '@illuma/core';

interface iContextScanner {
  /**
   * Scans the provided factory function for dependency injections.
   * 
   * @param factory - The factory function to scan for dependencies
   * @returns A set of detected injection nodes
   */
  scan(factory: any): Set<iInjectionNode<any>>;
}
```

**Parameters:**
- `factory`: The factory function being analyzed (could be a class constructor or factory function)

**Returns:**
- A `Set<iInjectionNode<any>>` containing all detected injection points

**Important notes:**
- Register scanners **before** providing services
- Scanners run in registration order
- Multiple scanners can be registered
- Scanners are global and affect all containers

---

## Diagnostics Modules

### What are Diagnostics Modules?

Diagnostics modules analyze the container state after bootstrap and provide insights, warnings, or custom reporting. They receive a comprehensive report about the container's state, including:

- Total number of dependency nodes
- List of unused dependencies
- Bootstrap performance metrics

### Diagnostics Module Interface

A diagnostics module must implement the `iDiagnosticsModule` interface:

```typescript
import type { TreeNode } from '@illuma/core';

interface iDiagnosticsReport {
  readonly totalNodes: number;        // Total dependency nodes in container
  readonly unusedNodes: TreeNode<unknown>[]; // Nodes that weren't resolved
  readonly bootstrapDuration: number; // Bootstrap time in milliseconds
}

interface iDiagnosticsModule {
  readonly onReport: (report: iDiagnosticsReport) => void;
}
```

**Report fields:**
- `totalNodes`: Total number of dependency nodes registered
- `unusedNodes`: Array of nodes that were never resolved during bootstrap
- `bootstrapDuration`: Time taken to bootstrap the container (in ms)

### Developing a Diagnostics Module

#### Example: Custom Performance Reporter

```typescript
import type { iDiagnosticsModule, iDiagnosticsReport } from '@illuma/core';

export class PerformanceReporter implements iDiagnosticsModule {
  public onReport(report: iDiagnosticsReport): void {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Container Performance Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⚡ Bootstrap Time: ${report.bootstrapDuration}ms`);
    console.log(`📦 Total Dependencies: ${report.totalNodes}`);
    console.log(`✅ Used Dependencies: ${report.totalNodes - report.unusedNodes.length}`);
    console.log(`⚠️ Unused Dependencies: ${report.unusedNodes.length}`);
    
    if (report.bootstrapDuration > 1000) {
      console.warn('⚠️ WARNING: Bootstrap took longer than 1 second!');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}
```

#### Example: Unused Dependency Validator

Throw an error if any dependencies are unused (strict mode):

```typescript
import type { iDiagnosticsModule, iDiagnosticsReport } from '@illuma/core';

export class StrictUnusedValidator implements iDiagnosticsModule {
  public onReport(report: iDiagnosticsReport): void {
    if (report.unusedNodes.length > 1) { // Leave one unused for entry point
      const unusedList = report.unusedNodes
        .map(node => `  - ${node.toString()}`)
        .join('\n');
      
      throw new Error(
        `Strict mode violation: Found ${report.unusedNodes.length} unused dependencies:\n${unusedList}`
      );
    }
  }
}
```

#### Example: JSON Diagnostics Logger

Send diagnostics to a logging service:

```typescript
import type { iDiagnosticsModule, iDiagnosticsReport } from '@illuma/core';

export class JsonDiagnosticsLogger implements iDiagnosticsModule {
  constructor(private readonly loggerService: LoggerService) {}

  public onReport(report: iDiagnosticsReport): void {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      container: {
        totalNodes: report.totalNodes,
        usedNodes: report.totalNodes - report.unusedNodes.length,
        unusedNodes: report.unusedNodes.map(node => node.toString()),
        bootstrapDuration: report.bootstrapDuration,
      },
      metrics: {
        usageRate: ((report.totalNodes - report.unusedNodes.length) / report.totalNodes) * 100,
        isHealthy: report.unusedNodes.length === 0,
        performanceGrade: this.getPerformanceGrade(report.bootstrapDuration),
      }
    };

    this.loggerService.log('container.diagnostics', diagnostics);
  }

  private getPerformanceGrade(durationMs: number): string {
    if (durationMs < 20) return 'A';
    if (durationMs < 50) return 'B';
    if (durationMs < 100) return 'C';
    return 'D';
  }
}
```

### Registering a Diagnostics Module

Diagnostics modules should be registered before bootstrapping the container. To enable the diagnostics system, you must call `enableIllumaDiagnostics()` from `@illuma/core/plugins`:

```typescript
import { Illuma, NodeContainer } from '@illuma/core';
import { PerformanceReporter } from './diagnostics';
import { enableIllumaDiagnostics } from '@illuma/core/plugins';

// 1. Enable diagnostics system
enableIllumaDiagnostics();

// 2. Register custom diagnostics module
Illuma.extendDiagnostics(new PerformanceReporter());

// 3. Create and configure container
const container = new NodeContainer({ measurePerformance: true });
container.provide([
  UserService,
  DatabaseService,
  LoggerService
]);

// 4. Bootstrap - diagnostics will run after this
container.bootstrap();
// Output:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 Container Performance Report
// ...
```

**Important notes:**
- Call `enableIllumaDiagnostics()` before bootstrapping to enable diagnostics
- Register custom modules before calling `bootstrap()`
- Multiple modules can be registered
- Modules execute in registration order
- Set `measurePerformance: true` in container options to get accurate timing

> **Note**: The `diagnostics: true` option in `NodeContainer` constructor is deprecated. Use `enableIllumaDiagnostics()` instead.

---

## Middlewares

### What are Middlewares?

Middlewares allow you to intercept and modify the instantiation process of dependencies in the container. They sit between the factory function execution and the returned instance, enabling you to:

- **Log dependency creation**
- **Measure instantiation time**
- **Wrap instances in Proxies**
- **Modify or replace instances**

Middlewares can be registered **globally** (for all containers) or **locally** (per container).
They are also inherited by child containers from parent containers.

### Middleware Interface

A middleware is a function that matches the `iMiddleware` signature:

```typescript
import type { NodeBase } from '@illuma/core';

interface iInstantiationParams<T = unknown> {
  readonly token: NodeBase<T>;  // The token being instantiated
  readonly factory: () => T;    // The factory function that creates the instance
  readonly deps: Set<Token<unknown>>; // The dependencies of the instance
}

type iMiddleware<T = unknown> = (
  params: iInstantiationParams<T>,
  next: (params: iInstantiationParams<T>) => T,
) => T;
```

**Parameters:**
- `params`: Context about what is being instantiated
- `next`: Function that calls the next middleware or the actual factory

**Returns:**
- The resulting instance `T` (or a modified/proxied version of it)

### Developing a Middleware

#### Example: Logging Middleware

Log every time a dependency is instantiated:

```typescript
import type { iMiddleware } from '@illuma/core';

export const loggerMiddleware: iMiddleware = (params, next) => {
  console.log(`[Middleware] Creating instance of: ${params.token.name}`);
  
  const start = Date.now();
  const instance = next(params);
  const duration = Date.now() - start;
  
  console.log(`[Middleware] Created ${params.token.name} in ${duration}ms`);
  
  return instance;
};
```

#### Example: Proxy Middleware

Automatically wrap certain services in a Proxy:

```typescript
import type { iMiddleware } from '@illuma/core';

export const proxyMiddleware: iMiddleware = (params, next) => {
  const instance = next(params);

  // Only apply to classes ending with "Service"
  if (params.token.name.endsWith('Service')) {
    return new Proxy(instance as object, {
      get(target, prop) {
        console.log(`Accessing ${params.token.name}.${String(prop)}`);
        return Reflect.get(target, prop);
      }
    });
  }

  return instance;
};
```

### Registering Middleware

#### Global Registration

Affects **all** containers created thereafter.

```typescript
import { Illuma } from '@illuma/core';

Illuma.registerGlobalMiddleware(loggerMiddleware);
```

#### Local Registration

Affects **only** the specific container instance.

```typescript
import { NodeContainer } from '@illuma/core';

const container = new NodeContainer();

container.registerMiddleware(proxyMiddleware); // Local middleware
container.provide([UserService]);
container.bootstrap();
```

---

## Best Practices

1. **Keep scanners focused**: Each scanner should handle one injection pattern
2. **Avoid side effects**: Scanners should only read, not modify state
3. **Handle errors gracefully**: Don't let scanner errors break the container
4. **Performance matters**: Scanners run for every provider, keep them fast
5. **Test thoroughly**: Test scanners with various factory function types

**Scanner performance tips:**
```typescript
export class OptimizedScanner implements iContextScanner {
  public scan(factory: any): Set<iInjectionNode<any>> {
    // Early return for non-functions just in case for future API changes
    if (typeof factory !== 'function') {
      return new Set();
    }

    // Cache metadata lookups
    const metadata = this.getCachedMetadata(factory);
    if (!metadata) {
      return new Set();
    }

    // Process efficiently
    return this.processMetadata(metadata);
  }
}
```

---

## Advanced Examples

### Property Injection Scanner

Support property-based injection using decorators:

```typescript
import type { iContextScanner, NodeToken, iInjectionNode } from '@illuma/core';

const PROPERTY_INJECT_KEY = Symbol('di:properties');

// Property decorator
export function InjectProperty<T>(token: NodeToken<T>) {
  return function (target: any, propertyKey: string) {
    const properties = Reflect.getMetadata(PROPERTY_INJECT_KEY, target.constructor) || [];
    properties.push({ propertyKey, token });
    Reflect.defineMetadata(PROPERTY_INJECT_KEY, properties, target.constructor);
  };
}

// Scanner implementation
export class PropertyInjectionScanner implements iContextScanner {
  public scan(factory: any): Set<iInjectionNode<any>> {
    const injections = new Set<iInjectionNode<any>>();

    if (typeof factory !== 'function') {
      return injections;
    }

    const properties = Reflect.getMetadata(PROPERTY_INJECT_KEY, factory);
    if (!properties) {
      return injections;
    }

    for (const { token } of properties) {
      injections.add({ token, optional: false });
    }

    return injections;
  }
}
```

Register the scanner:

```typescript
Illuma.extendContextScanner(new PropertyInjectionScanner());
```

Now properties decorated with `@InjectProperty()` will be detected, but not injected automatically. You will need to implement property injection logic yourself.

### Conditional Diagnostics Reporter

Only report diagnostics in development mode:

```typescript
import { enableIllumaDiagnostics } from '@illuma/core/plugins';
import type { iDiagnosticsModule, iDiagnosticsReport } from '@illuma/core';

export class ConditionalReporter implements iDiagnosticsModule {
  constructor(
    private readonly enabled: boolean = process.env.NODE_ENV !== 'production'
  ) {}

  public onReport(report: iDiagnosticsReport): void {
    if (!this.enabled) {
      return;
    }

    // Detailed reporting for development
    console.group('🔍 Container Diagnostics (Development Mode)');
    console.log('Total Nodes:', report.totalNodes);
    console.log('Bootstrap Duration:', `${report.bootstrapDuration}ms`);
    
    if (report.unusedNodes.length > 0) {
      console.group('⚠️  Unused Dependencies:');
      for (const node of report.unusedNodes) {
        console.log(`  - ${node.toString()}`);
      }
      console.groupEnd();
    } else {
      console.log('✅ All dependencies are being used');
    }
    
    console.groupEnd();
  }
}

// Usage - enable diagnostics and register the reporter
if (process.env.NODE_ENV === 'development') {
  enableIllumaDiagnostics();
  Illuma.extendDiagnostics(new ConditionalReporter());
}
```

---

## Plugin Lifecycle

Understanding when plugins execute is crucial for proper usage:

```typescript
// 1. Enable diagnostics (if needed)
enableIllumaDiagnostics();

// 2. Register plugins (before container creation)
Illuma.extendContextScanner(myScanner);
Illuma.extendDiagnostics(myDiagnosticsModule);

// 3. Create container
const container = new NodeContainer({ measurePerformance: true });

// 4. Provide services (scanners run here for each provider)
container.provide([
  UserService,      // Scanner runs
  DatabaseService,  // Scanner runs
  LoggerService     // Scanner runs
]);

// 5. Bootstrap (diagnostics modules run after this)
container.bootstrap();
// → All diagnostics modules execute with report
```

**Timeline:**
1. **Enable Diagnostics**: Call `enableIllumaDiagnostics()` to activate the system
2. **Plugin Registration**: Plugins added to global registry
3. **Provider Registration**: Context scanners run for each provider
4. **Bootstrap**: Container resolves dependencies
5. **Post-Bootstrap**: Diagnostics modules receive report

---

## Existing Plugins

### @illuma/reflect - Injections via constructor metadata and property decorators
- GitHub: [git-illuma/reflect](https://github.com/git-illuma/reflect)
- NPM: [@illuma/reflect](https://www.npmjs.com/package/@illuma/reflect)

## Next Steps

- Explore the [API Reference](./API.md) for detailed type information
- Learn about [Tokens](./TOKENS.md) for creating custom injection tokens
- Check out [Providers](./PROVIDERS.md) to understand provider types
- Read [Troubleshooting](./TROUBLESHOOTING.md) for common issues

For questions or issues with plugins, please [open an issue](https://github.com/git-illuma/core/issues) on GitHub.
