# 🔌 Plugin System

Illuma provides a plugin system that allows you to extend its core functionality. The plugin system supports two types of plugins:

1. **Context Scanners** – Extend injection detection to support custom patterns
2. **Diagnostics Modules** – Analyze and report on container state after bootstrap

## Table of Contents

- [🔌 Plugin System](#-plugin-system)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Context Scanners](#context-scanners)
    - [What are Context Scanners?](#what-are-context-scanners)
    - [Context Scanner Interface](#context-scanner-interface)
    - [Developing a Context Scanner](#developing-a-context-scanner)
      - [Example: Custom Decorator Scanner](#example-custom-decorator-scanner)
      - [Example: Metadata-based Scanner](#example-metadata-based-scanner)
    - [Registering a Context Scanner](#registering-a-context-scanner)
  - [Diagnostics Modules](#diagnostics-modules)
    - [What are Diagnostics Modules?](#what-are-diagnostics-modules)
    - [Diagnostics Module Interface](#diagnostics-module-interface)
    - [Developing a Diagnostics Module](#developing-a-diagnostics-module)
      - [Example: Custom Performance Reporter](#example-custom-performance-reporter)
      - [Example: Unused Dependency Validator](#example-unused-dependency-validator)
      - [Example: JSON Diagnostics Logger](#example-json-diagnostics-logger)
    - [Registering a Diagnostics Module](#registering-a-diagnostics-module)
  - [Best Practices](#best-practices)
  - [Advanced Examples](#advanced-examples)
    - [Property Injection Scanner](#property-injection-scanner)
    - [Conditional Diagnostics Reporter](#conditional-diagnostics-reporter)
  - [Plugin Lifecycle](#plugin-lifecycle)
  - [Next Steps](#next-steps)

---

## Overview

The `PluginContainer` class is the central hub for managing plugins in Illuma. It provides static methods to register plugins globally, which will then be automatically invoked at the appropriate times during the container lifecycle.

```typescript
import { PluginContainer } from '@zodyac/illuma';

// Register a context scanner
PluginContainer.extendContextScanner(myScanner);

// Register a diagnostics module
PluginContainer.extendDiagnostics(myDiagnostics);
```

**Key characteristics:**
- Plugins are registered **globally** and affect all container instances
- Context scanners run during **detection** phase (before building dependency graph)
- Diagnostics modules run after each container bootstrap completes (also during application runtime when instantiating a child container)
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
import type { InjectionNode } from '@zodyac/illuma';

interface iContextScanner {
  /**
   * Scans the provided factory function for dependency injections.
   * 
   * @param factory - The factory function to scan for dependencies
   * @returns A set of detected injection nodes
   */
  scan(factory: any): Set<InjectionNode<any>>;
}
```

**Parameters:**
- `factory`: The factory function being analyzed (could be a class constructor or factory function)

**Returns:**
- A `Set<InjectionNode<any>>` containing all detected injection points

### Developing a Context Scanner

#### Example: Custom Decorator Scanner

Let's create a scanner that detects a custom `@Inject()` decorator:

```typescript
import { InjectionNode, NodeToken } from '@zodyac/illuma';
import type { iContextScanner } from '@zodyac/illuma';

// First, define the custom decorator
const INJECT_METADATA_KEY = Symbol('custom:inject');

export function Inject(token: NodeToken<any>) {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    const existingInjections = Reflect.getMetadata(INJECT_METADATA_KEY, target) || [];
    existingInjections.push({ parameterIndex, token });
    Reflect.defineMetadata(INJECT_METADATA_KEY, existingInjections, target);
  };
}

// Now, create the scanner
export class CustomDecoratorScanner implements iContextScanner {
  public scan(factory: any): Set<InjectionNode<any>> {
    const injections = new Set<InjectionNode<any>>();

    // Check if factory is a class constructor
    if (typeof factory !== 'function') {
      return injections;
    }

    // Check for metadata
    const metadata = Reflect.getMetadata(INJECT_METADATA_KEY, factory);
    if (!metadata || !Array.isArray(metadata)) {
      return injections;
    }

    // Create injection nodes from metadata
    for (const { token } of metadata) {
      const node = new InjectionNode(token, false);
      injections.add(node);
    }

    return injections;
  }
}
```

**Usage:**

```typescript
import { PluginContainer } from '@zodyac/illuma';

// Register the scanner globally
PluginContainer.extendContextScanner(new CustomDecoratorScanner());

// Now you can use the custom decorator
class MyService {
  constructor(@Inject(DATABASE_TOKEN) db: Database) {
    // db will be injected
  }
}
```

#### Example: Metadata-based Scanner

Create a scanner that reads injection metadata stored by a build tool or preprocessor:

```typescript
import { InjectionNode } from '@zodyac/illuma';
import type { iContextScanner } from '@zodyac/illuma';

const INJECTIONS_KEY = Symbol.for('di:injections');

interface InjectionMetadata {
  tokens: any[];
  optional: boolean[];
}

export class MetadataScanner implements iContextScanner {
  public scan(factory: any): Set<InjectionNode<any>> {
    const injections = new Set<InjectionNode<any>>();

    if (typeof factory !== 'function') {
      return injections;
    }

    // Read metadata attached by build tool
    const metadata: InjectionMetadata = (factory as any)[INJECTIONS_KEY];
    
    if (!metadata || !metadata.tokens) {
      return injections;
    }

    // Create injection nodes
    for (let i = 0; i < metadata.tokens.length; i++) {
      const token = metadata.tokens[i];
      const optional = metadata.optional[i] || false;
      const node = new InjectionNode(token, optional);
      injections.add(node);
    }

    return injections;
  }
}
```

### Registering a Context Scanner

Context scanners must be registered **before** creating your container or providing any services:

```typescript
import { PluginContainer, NodeContainer } from '@zodyac/illuma';
import { CustomDecoratorScanner } from './scanners';

// 1. Register scanner first
PluginContainer.extendContextScanner(new CustomDecoratorScanner());

// 2. Then create container and provide services
const container = new NodeContainer();
container.provide([
  MyService,
  AnotherService
]);

// 3. Bootstrap
container.bootstrap();
```

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
import type { TreeNode } from '@zodyac/illuma';

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
import type { iDiagnosticsModule, iDiagnosticsReport } from '@zodyac/illuma';

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
import type { iDiagnosticsModule, iDiagnosticsReport } from '@zodyac/illuma';

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
import type { iDiagnosticsModule, iDiagnosticsReport } from '@zodyac/illuma';

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

Diagnostics modules should be registered before bootstrapping the container:

```typescript
import { PluginContainer, NodeContainer } from '@zodyac/illuma';
import { PerformanceReporter } from './diagnostics';

// 1. Register diagnostics module
PluginContainer.extendDiagnostics(new PerformanceReporter());

// 2. Create and configure container
const container = new NodeContainer({ measurePerformance: true });
container.provide([
  UserService,
  DatabaseService,
  LoggerService
]);

// 3. Bootstrap - diagnostics will run after this
container.bootstrap();
// Output:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 Container Performance Report
// ...
```

**Important notes:**
- Register before calling `bootstrap()`
- Multiple modules can be registered
- Modules execute in registration order
- Set `measurePerformance: true` in container options to get accurate timing

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
  public scan(factory: any): Set<InjectionNode<any>> {
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
import { InjectionNode } from '@zodyac/illuma';
import type { iContextScanner } from '@zodyac/illuma';

const PROPERTY_INJECT_KEY = Symbol('di:properties');

// Property decorator
export function InjectProperty(token: any) {
  return function (target: any, propertyKey: string) {
    const properties = Reflect.getMetadata(PROPERTY_INJECT_KEY, target.constructor) || [];
    properties.push({ propertyKey, token });
    Reflect.defineMetadata(PROPERTY_INJECT_KEY, properties, target.constructor);
  };
}

// Scanner implementation
export class PropertyInjectionScanner implements iContextScanner {
  public scan(factory: any): Set<InjectionNode<any>> {
    const injections = new Set<InjectionNode<any>>();

    if (typeof factory !== 'function') {
      return injections;
    }

    const properties = Reflect.getMetadata(PROPERTY_INJECT_KEY, factory);
    if (!properties) {
      return injections;
    }

    for (const { token } of properties) {
      injections.add(new InjectionNode(token, false));
    }

    return injections;
  }
}
```

**Usage:**

```typescript
class UserService {
  @InjectProperty(DATABASE_TOKEN)
  private database!: Database;

  @InjectProperty(LOGGER_TOKEN)
  private logger!: Logger;

  getUsers() {
    this.logger.info('Fetching users');
    return this.database.query('SELECT * FROM users');
  }
}

// Register the scanner
PluginContainer.extendContextScanner(new PropertyInjectionScanner());
```

### Conditional Diagnostics Reporter

Only report diagnostics in development mode:

```typescript
import type { iDiagnosticsModule, iDiagnosticsReport } from '@zodyac/illuma';

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

// Usage
PluginContainer.extendDiagnostics(
  new ConditionalReporter(process.env.NODE_ENV === 'development')
);
```

---

## Plugin Lifecycle

Understanding when plugins execute is crucial for proper usage:

```typescript
// 1. Register plugins (before container creation)
PluginContainer.extendContextScanner(myScanner);
PluginContainer.extendDiagnostics(myDiagnostics);

// 2. Create container
const container = new NodeContainer({ measurePerformance: true });

// 3. Provide services (scanners run here for each provider)
container.provide([
  UserService,      // Scanner runs
  DatabaseService,  // Scanner runs
  LoggerService     // Scanner runs
]);

// 4. Bootstrap (diagnostics modules run after this)
container.bootstrap();
// → All diagnostics modules execute with report
```

**Timeline:**
1. **Plugin Registration**: Plugins added to global registry
2. **Provider Registration**: Context scanners run for each provider
3. **Bootstrap**: Container resolves dependencies
4. **Post-Bootstrap**: Diagnostics modules receive report

---

## Next Steps

- Explore the [API Reference](./API.md) for detailed type information
- Learn about [Tokens](./TOKENS.md) for creating custom injection tokens
- Check out [Providers](./PROVIDERS.md) to understand provider types
- Read [Troubleshooting](./TROUBLESHOOTING.md) for common issues

For questions or issues with plugins, please [open an issue](https://github.com/zodyac/illuma/issues) on GitHub.
