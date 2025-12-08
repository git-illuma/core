# 🔗 Async Injection & Sub-Containers

This guide covers advanced dependency injection patterns using `injectAsync`, `injectChildrenAsync`, and `injectGroupAsync` for lazy-loading dependencies and managing sub-containers.

## Table of Contents

- [🔗 Async Injection \& Sub-Containers](#-async-injection--sub-containers)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [injectAsync](#injectasync)
    - [Basic Usage](#basic-usage)
    - [Use Cases](#use-cases)
      - [1. **Code Splitting \& Lazy Loading**](#1-code-splitting--lazy-loading)
      - [2. **Conditional Dependencies**](#2-conditional-dependencies)
    - [Type Safety](#type-safety)
    - [Caching Behavior](#caching-behavior)
    - [Overriding Dependencies](#overriding-dependencies)
  - [injectChildrenAsync](#injectchildrenasync)
    - [Basic Usage](#basic-usage-1)
    - [Use Cases](#use-cases-1)
      - [1. **Plugin Systems**](#1-plugin-systems)
      - [2. **Feature Modules**](#2-feature-modules)
      - [3. **Scoped Contexts**](#3-scoped-contexts)
    - [Parent-Child Relationships](#parent-child-relationships)
    - [Caching Behavior](#caching-behavior-1)
    - [Overriding Dependencies](#overriding-dependencies-1)
  - [injectGroupAsync](#injectgroupasync)
    - [Basic Usage](#basic-usage-2)
    - [Migration from injectChildrenAsync](#migration-from-injectchildrenasync)
    - [Caching Behavior](#caching-behavior-2)
    - [Overriding Dependencies](#overriding-dependencies-2)
  - [Common Patterns](#common-patterns)
    - [Pattern 1: Dynamic Feature Loading](#pattern-1-dynamic-feature-loading)
    - [Pattern 2: Lazy Service Registry](#pattern-2-lazy-service-registry)
    - [Pattern 3: Conditional Module Loading](#pattern-3-conditional-module-loading)
  - [Best Practices](#best-practices)
    - [✅ Do's](#-dos)
    - [❌ Don'ts](#-donts)
  - [Performance Considerations](#performance-considerations)
    - [Lazy Loading Benefits](#lazy-loading-benefits)
    - [Caching Impact](#caching-impact)
    - [Memory Considerations](#memory-considerations)
  - [Related Documentation](#related-documentation)
  - [Questions or Feedback?](#questions-or-feedback)

## Overview

Illuma provides three powerful utilities for advanced dependency injection scenarios:

- **`injectAsync`**: Lazily inject dependencies that may require async initialization or dynamic imports
- **`injectChildrenAsync`**: *(deprecated)* Create isolated sub-containers with provider sets
- **`injectGroupAsync`**: Create isolated sub-containers with arrays of providers (recommended over `injectChildrenAsync`)

All utilities support:
- ✅ Async factory functions
- ✅ Dynamic imports for code splitting
- ✅ Optional caching
- ✅ Full type inference
- ✅ Dependency overrides
- ✅ Parent container access

## injectAsync

`injectAsync` creates a function that lazily resolves a dependency. The dependency is provided in a temporary sub-container that inherits from the parent.

### Basic Usage

```typescript
import { injectAsync, NodeInjectable } from '@zodyac/illuma';

@NodeInjectable()
class UserService {
  // Lazy-load a heavy analytics module
  private readonly getAnalytics = injectAsync(
    () => import('./analytics').then((m) => m.AnalyticsService),
  );

  async trackUserAction(userId: string, action: string) {
    // Analytics module is only loaded when this method is called
    // By default, the instance is cached, so subsequent calls reuse it
    const analytics = await this.getAnalytics();
    analytics.track(userId, action);
  }
}
```

### Use Cases

#### 1. **Code Splitting & Lazy Loading**

Reduce initial bundle size by loading heavy dependencies on-demand:

```typescript
import { injectAsync } from '@zodyac/illuma';

@NodeInjectable()
class ReportGenerator {
  private readonly getPdfEngine = injectAsync(
    () => import('./pdf-engine').then((m) => m.PdfEngine),
  );

  async generateReport(data: ReportData) {
    const pdf = await this.getPdfEngine();
    return pdf.generate(data);
  }
}
```

#### 2. **Conditional Dependencies**

Load different implementations based on runtime conditions:

```typescript
@NodeInjectable()
class StorageService {
  private readonly getStorage = injectAsync(async () => {
    if (process.env.NODE_ENV === 'production') {
      return import('./s3-storage').then((m) => m.S3Storage);
    } else {
      return import('./local-storage').then((m) => m.LocalStorage);
    }
  });

  async save(key: string, data: any) {
    const storage = await this.getStorage();
    return storage.save(key, data);
  }
}
```

### Type Safety

`injectAsync` provides full type inference:

```typescript
// Single token
const getLogger = injectAsync(async () => Logger);
const logger = await getLogger(); // Type: Logger

// Multi-token
const getPlugins = injectAsync(async () => PLUGINS);
const plugins = await getPlugins(); // Type: Plugin[]

// Constructor
const getService = injectAsync(async () => MyService);
const service = await getService(); // Type: MyService
```

### Caching Behavior

By default, `injectAsync` caches the result to prevent multiple instantiations:

```typescript
@NodeInjectable()
class MyService {
  private readonly getAnalytics = injectAsync(async () => AnalyticsService);

  async method1() {
    const analytics = await this.getAnalytics(); // Creates instance
  }

  async method2() {
    const analytics = await this.getAnalytics(); // Returns cached instance
  }
}
```

To disable caching and create a new instance each time:

```typescript
private readonly getAnalytics = injectAsync(
  async () => AnalyticsService,
  { withCache: false }
);
```

### Overriding Dependencies

You can provide additional dependencies or override parent container values using the `overrides` option:

```typescript
const CONFIG_TOKEN = new NodeToken<Config>('CONFIG');
const API_URL = new NodeToken<string>('API_URL');

@NodeInjectable()
class ApiService {
  private readonly config = nodeInject(CONFIG_TOKEN);
  private readonly apiUrl = nodeInject(API_URL);
}

@NodeInjectable()
class MyService {
  // Provide additional dependencies for the injected service
  private readonly getApiService = injectAsync(
    async () => ApiService,
    {
      overrides: [
        { provide: API_URL, value: 'https://api.example.com' },
        { provide: CONFIG_TOKEN, value: { timeout: 5000 } }
      ]
    }
  );

  async makeRequest() {
    const api = await this.getApiService();
    // api has access to both API_URL and CONFIG_TOKEN
  }
}
```

**Important**: If the main provider and overrides both provide the same token, a duplicate provider error will be thrown. Use overrides for:
- Providing additional tokens not in the main provider
- Shadowing parent container values with different values in the sub-container

## injectChildrenAsync

`injectChildrenAsync` creates an isolated sub-container with its own dependency tree. This is useful for plugin systems, feature modules, and scoped contexts with access to parent dependencies.

> [!NOTE]
> For better dynamic imports, define tokens in a separate file to avoid leaking unwanted code dependencies into the main bundle.


### Basic Usage

```typescript
// In feature-tokens.ts
import { NodeToken } from '@zodyac/illuma';

export const FEATURE_CONFIG = new NodeToken<iFeatureConfig>('FEATURE_CONFIG');
export const FEATURE_SERVICE = new NodeToken<FeatureService>('FEATURE_SERVICE');
export const FEATURE_REPOSITORY = new NodeToken<FeatureRepository>('FEATURE_REPOSITORY');
```

```typescript
// In provide-features.ts
import { createProviderSet } from '@zodyac/illuma';
import { FEATURE_SERVICE, FEATURE_REPOSITORY, FEATURE_CONFIG } from './feature-tokens';
import { FeatureService } from './feature-service';
import { FeatureRepository } from './feature-repository';

export function provideFeatures() {
  return createProviderSet(
    {
      provide: FEATURE_SERVICE,
      useClass: FeatureService
    },
    {
      provide: FEATURE_REPOSITORY,
      useClass: FeatureRepository
    },
    {
      provide: FEATURE_CONFIG,
      value: { enableBeta: true }
    }
  );
}
```
And then in the host service:

```typescript
import { injectChildrenAsync, NodeInjectable } from '@zodyac/illuma';
import { createProviderSet } from '@zodyac/illuma';
import { FEATURE_SERVICE, FEATURE_REPOSITORY } from './feature-tokens';

@NodeInjectable()
class FeatureHost {
  private readonly getFeatureInjector = injectChildrenAsync(
    () => import('./feature-module').then((m) => m.provideFeatures())
  );

  async executeFeature() {
    // Get the injector for the sub-container
    const injector = await this.getFeatureInjector();

    // Retrieve services from the sub-container
    const featureService = injector.get(FEATURE_SERVICE);
    featureService.execute();

    const featureRepo = injector.get(FEATURE_REPOSITORY);
    featureRepo.fetchData();
  }
}
```

### Use Cases

#### 1. **Plugin Systems**

Create isolated contexts for plugins:

```typescript
interface PluginConfig {
  name: string;
  version: string;
}

const PLUGIN_CORE = new NodeToken<iPluginCore>('PLUGIN_CORE');
const PLUGIN_CONFIG = new NodeToken<PluginConfig>('PLUGIN_CONFIG');

@NodeInjectable()
class PluginLoader {
  private readonly createPluginContext = injectChildrenAsync(async () => {
    const { PluginCore } = await import('./plugin-core');

    return createProviderSet(
      {
        provide: PLUGIN_CORE,
        useClass: PluginCore,
      },
      {
        provide: PLUGIN_CONFIG,
        value: { name: 'MyPlugin', version: '1.0.0' },
      }
    );
  });

  public async loadPlugin() {
    const pluginInjector = await this.createPluginContext();
    const plugin = pluginInjector.get(PLUGIN_CORE);
    plugin.initialize();
  }
}
```

#### 2. **Feature Modules**

Organize large applications into feature modules with their own dependencies:

```typescript
// In admin-tokens.ts

// Note: You can use classes as types directly if preferred, don't forget to import them as types to prevent code bloat in the main bundle:

import type { AdminService } from './admin-service';
import type { AdminController } from './admin-controller';
import type { AdminConfig } from './admin-config';
import type { AdminRepository } from './admin-repository';

export const ADMIN_CONFIG = new NodeToken<AdminConfig>('ADMIN_CONFIG');
export const ADMIN_SERVICE = new NodeToken<AdminService>('ADMIN_SERVICE');
export const ADMIN_CONTROLLER = new NodeToken<AdminController>('ADMIN_CONTROLLER');
export const ADMIN_REPOSITORY = new NodeToken<AdminRepository>('ADMIN_REPOSITORY');

```

```typescript
// admin-feature.ts
import { createProviderSet } from '@zodyac/illuma';
import { AdminService } from './admin-service';
import { AdminController } from './admin-controller';
import { AdminRepository } from './admin-repository';
import {
  ADMIN_CONFIG,
  ADMIN_SERVICE,
  ADMIN_CONTROLLER,
  ADMIN_REPOSITORY
} from './admin-tokens';

export const adminProviders = createProviderSet(
  {
    provide: ADMIN_SERVICE,
    useClass: AdminService
  },
  {
    provide: ADMIN_CONTROLLER,
    useClass: AdminController
  },
  {
    provide: ADMIN_REPOSITORY,
    useClass: AdminRepository
  },
  {
    provide: ADMIN_CONFIG,
    value: { permissions: ['read', 'write', 'delete'] }
  }
);
```

```typescript

// app.ts
@NodeInjectable()
class Application {
  private readonly getAdminModule = injectChildrenAsync(
    () => import('./admin-feature').then((m) => m.adminProviders)
  );

  public async loadAdminFeature() {
    const adminInjector = await this.getAdminModule();
    const adminController = adminInjector.get(AdminController);
    adminController.initialize();
  }
}
```

#### 3. **Scoped Contexts**

Create request-scoped or session-scoped containers:

```typescript
interface RequestContext {
  userId: string;
  requestId: string;
}

const REQUEST_CONTEXT = new NodeToken<RequestContext>('REQUEST_CONTEXT');

@NodeInjectable()
class RequestHandler {
  private createRequestContext(userId: string, requestId: string) {
    return injectChildrenAsync(async () => {
      return createProviderSet(
        RequestService,
        {
          provide: REQUEST_CONTEXT,
          value: { userId, requestId }
        }
      );
    });
  }

  async handleRequest(userId: string, requestId: string) {
    const getRequestInjector = this.createRequestContext(userId, requestId);
    const requestInjector = await getRequestInjector();

    const requestService = requestInjector.get(RequestService);
    return requestService.process();
  }
}
```

### Parent-Child Relationships

Sub-containers created with `injectChildrenAsync` inherit from their parent container:

```typescript
// Parent container
const parentContainer = new NodeContainer();
parentContainer.provide(Logger);
parentContainer.provide(Config);
parentContainer.bootstrap();

// In a service injected from parent
@NodeInjectable()
class ParentService {
  private readonly getChildInjector = injectChildrenAsync(async () => {
    return createProviderSet(
      ChildService // Can inject Logger and Config from parent
    );
  });
}

@NodeInjectable()
class ChildService {
  private readonly logger = nodeInject(Logger); // From parent
  private readonly config = nodeInject(Config); // From parent
}
```

### Caching Behavior

Like `injectAsync`, `injectChildrenAsync` caches the sub-container by default:

```typescript
@NodeInjectable()
class FeatureHost {
  private readonly getFeatureInjector = injectChildrenAsync(
    async () => featureProviders
  );

  async method1() {
    const injector = await this.getFeatureInjector(); // Creates sub-container
  }

  async method2() {
    const injector = await this.getFeatureInjector(); // Returns same sub-container
  }
}
```

Disable caching to create a new sub-container each time:

```typescript
private readonly getFeatureInjector = injectChildrenAsync(
  async () => featureProviders,
  { withCache: false }
);
```

### Overriding Dependencies

You can provide additional dependencies or override parent container values in the sub-container using the `overrides` option:

```typescript
const FEATURE_CONFIG = new NodeToken<FeatureConfig>('FEATURE_CONFIG');
const FEATURE_MODE = new NodeToken<string>('FEATURE_MODE');

@NodeInjectable()
class FeatureHost {
  private readonly getFeatureInjector = injectChildrenAsync(
    async () => {
      const { featureProviders } = await import('./feature-module');
      return featureProviders; // Provides FEATURE_CONFIG
    },
    {
      // Provide additional tokens for the sub-container
      overrides: [
        { provide: FEATURE_MODE, value: 'production' }
      ]
    }
  );

  async loadFeature() {
    const injector = await this.getFeatureInjector();
    const mode = injector.get(FEATURE_MODE); // 'production'
    const config = injector.get(FEATURE_CONFIG); // From featureProviders
  }
}
```

**Important**: Overrides are provided to the sub-container BEFORE the provider set is included. If both the provider set and overrides provide the same token, a duplicate provider error will be thrown. Use overrides for:
- Providing additional tokens not in the provider set
- Shadowing parent container values with different values for the sub-container

## injectGroupAsync

`injectGroupAsync` creates an isolated sub-container using an array of providers instead of a provider set. This is the recommended approach over `injectChildrenAsync` for most use cases.

### Basic Usage

```typescript
import { injectGroupAsync, NodeInjectable, NodeToken } from '@zodyac/illuma';

const FEATURE_CONFIG = new NodeToken<FeatureConfig>('FEATURE_CONFIG');
const FEATURE_SERVICE = new NodeToken<FeatureService>('FEATURE_SERVICE');

@NodeInjectable()
class FeatureHost {
  private readonly getFeatureInjector = injectGroupAsync(async () => {
    const { FeatureService } = await import('./feature-service');

    return [
      { provide: FEATURE_SERVICE, useClass: FeatureService },
      { provide: FEATURE_CONFIG, value: { enabled: true } }
    ];
  });

  async executeFeature() {
    const injector = await this.getFeatureInjector();
    const service = injector.get(FEATURE_SERVICE);
    service.execute();
  }
}
```

### Migration from injectChildrenAsync

`injectGroupAsync` is functionally equivalent to `injectChildrenAsync` but uses arrays of providers instead of provider sets:

```typescript
// Old approach (deprecated)
import { createProviderSet, injectChildrenAsync } from '@zodyac/illuma';

private readonly getInjector = injectChildrenAsync(async () => {
  return createProviderSet(
    ServiceA,
    ServiceB,
    { provide: CONFIG, value: config }
  );
});

// New approach (recommended)
import { injectGroupAsync } from '@zodyac/illuma';

private readonly getInjector = injectGroupAsync(async () => {
  return [
    ServiceA,
    ServiceB,
    { provide: CONFIG, value: config }
  ];
});
```

### Caching Behavior

Like other async injection utilities, `injectGroupAsync` caches the sub-container by default:

```typescript
@NodeInjectable()
class FeatureHost {
  private readonly getFeatureInjector = injectGroupAsync(
    async () => [/* providers */]
  );

  async method1() {
    const injector = await this.getFeatureInjector(); // Creates sub-container
  }

  async method2() {
    const injector = await this.getFeatureInjector(); // Returns cached sub-container
  }
}
```

Disable caching to create a new sub-container each time:

```typescript
private readonly getFeatureInjector = injectGroupAsync(
  async () => [/* providers */],
  { withCache: false }
);
```

### Overriding Dependencies

Like `injectChildrenAsync`, you can provide additional dependencies or override parent values using the `overrides` option:

```typescript
const DATABASE_URL = new NodeToken<string>('DATABASE_URL');
const API_KEY = new NodeToken<string>('API_KEY');

@NodeInjectable()
class AppService {
  private readonly getDataModule = injectGroupAsync(
    async () => {
      const { DataService, DataRepository } = await import('./data-module');
      return [
        DataService,
        DataRepository
      ];
    },
    {
      overrides: [
        { provide: DATABASE_URL, value: 'postgresql://localhost/mydb' },
        { provide: API_KEY, value: 'secret-key' }
      ]
    }
  );

  async loadData() {
    const injector = await this.getDataModule();
    const dataService = injector.get(DataService);
    // dataService has access to DATABASE_URL and API_KEY
  }
}
```

**Important**: Overrides are provided to the sub-container BEFORE the provider array. If both the provider array and overrides provide the same token, a duplicate provider error will be thrown. Use overrides for:
- Providing additional tokens not in the provider array
- Shadowing parent container values with different values for the sub-container

## Common Patterns

> **Note**: All async injection functions (`injectAsync`, `injectChildrenAsync`, `injectGroupAsync`) support an `overrides` option to provide additional dependencies or shadow parent container values. See the respective function documentation for details.

### Pattern 1: Dynamic Feature Loading

```typescript
interface FeatureManifest {
  name: string;
  load: () => Promise<iNodeProviderSet>;
}

@NodeInjectable()
class FeatureManager {
  private features = new Map<string, () => Promise<iInjector>>();

  registerFeature(manifest: FeatureManifest) {
    const loader = injectChildrenAsync(manifest.load);
    this.features.set(manifest.name, loader);
  }

  async loadFeature(name: string) {
    const loader = this.features.get(name);
    if (!loader) throw new Error(`Feature ${name} not found`);

    return loader();
  }
}

// Usage
const manager = container.get(FeatureManager);

manager.registerFeature({
  name: 'analytics',
  load: async () => {
    const { analyticsProviders } = await import('./features/analytics');
    return analyticsProviders;
  }
});

const analyticsInjector = await manager.loadFeature('analytics');
```

### Pattern 2: Lazy Service Registry

```typescript
class ServiceRegistry {
  private registry = new Map<string, () => Promise<any>>();

  register<T>(key: string, loader: () => Promise<NodeToken<T> | Ctor<T>>) {
    this.registry.set(key, injectAsync(loader));
  }

  async get<T>(key: string): Promise<T> {
    const loader = this.registry.get(key);
    if (!loader) throw new Error(`Service ${key} not registered`);

    return loader();
  }
}
```

### Pattern 3: Conditional Module Loading

```typescript
@NodeInjectable()
class AppBootstrap {
  private readonly config = nodeInject(APP_CONFIG);

  private readonly getPaymentModule = injectChildrenAsync(async () => {
    if (this.config.features.payments) {
      const { paymentProviders } = await import('./modules/payments');
      return paymentProviders;
    }
    return createProviderSet(); // Empty set
  });

  async initialize() {
    if (this.config.features.payments) {
      const paymentInjector = await this.getPaymentModule();
      const paymentService = paymentInjector.get(PaymentService);
      await paymentService.initialize();
    }
  }
}
```

## Best Practices

### ✅ Do's

1. **Use for Code Splitting**
   ```typescript
   // Good: Reduce initial bundle size
   private readonly getReportEngine = injectAsync(async () => {
     const { ReportEngine } = await import('./heavy-report-engine');
     return ReportEngine;
   });
   ```

2. **Cache by Default**
   ```typescript
   // Good: Prevent multiple instantiations
   private readonly getAnalytics = injectAsync(async () => AnalyticsService);
   ```

3. **Use Sub-Containers for Isolation**
   ```typescript
   // Good: Isolated plugin contexts
   private readonly getPluginContext = injectChildrenAsync(
     async () => createProviderSet(/* plugin providers */)
   );
   ```

### ❌ Don'ts

1. **Don't Overuse**
   ```typescript
   // Bad: Unnecessary async for simple dependencies
   private readonly getLogger = injectAsync(async () => Logger);
   // Good: Use regular injection
   private readonly logger = nodeInject(Logger);
   ```

2. **Don't Create Circular Dependencies**
   ```typescript
   // Bad: Circular dependency via async injection
   @NodeInjectable()
   class ServiceA {
     private readonly getB = injectAsync(async () => ServiceB);
   }

   @NodeInjectable()
   class ServiceB {
     private readonly getA = injectAsync(async () => ServiceA); // Circular!
   }
   ```

3. **Don't Disable Caching Unnecessarily**
   ```typescript
   // Bad: Creates new instances every time (unless intentional)
   private readonly getService = injectAsync(
     async () => ExpensiveService,
     { withCache: false }
   );
   ```

4. **Don't Mix Sync and Async Unnecessarily**
   ```typescript
   // Bad: Using async when sync would work
   private readonly getConfig = injectAsync(async () => ConfigService);

   async method() {
     const config = await this.getConfig(); // Extra await
   }

   // Good: Use sync injection
   private readonly config = nodeInject(ConfigService);

   method() {
     const config = this.config; // Direct access
   }
   ```

## Performance Considerations

### Lazy Loading Benefits

```typescript
// Initial bundle: ~100KB
// Report engine: ~500KB (only loaded when needed)

@NodeInjectable()
class ReportService {
  private readonly getReportEngine = injectAsync(
    () => import('./report-engine').then((m) => m.ReportEngine)
  );

  async generateReport() {
    const engine = await this.getReportEngine(); // Loaded on-demand
    return engine.generate();
  }
}
```

### Caching Impact

```typescript
// Without cache: Creates new sub-container each time (~10ms overhead)
private readonly getPlugins = injectChildrenAsync(
  async () => pluginProviders,
  { withCache: false }
);

// With cache: Sub-container created once (~0ms after first call)
// Note: runtime async overhead remains
private readonly getPlugins = injectChildrenAsync(
  async () => pluginProviders,
  { withCache: true } // Default
);
```

### Memory Considerations

Cached instances remain in memory until the parent service is garbage collected:

```typescript
@NodeInjectable()
class LongLivedService {
  // This sub-container will live from when this method is first executed and until LongLivedService is garbage collected
  private readonly getHeavyModule = injectChildrenAsync(
    async () => heavyModuleProviders
  );
}
```

---

## Related Documentation

- [Main README](../README.md) - Getting started and core concepts
- [API Reference](./API.md) - Complete API documentation
- [Testing Guide](./TESTKIT.md) - Testing with Illuma
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

## Questions or Feedback?

If you have questions or suggestions about async injection patterns, please [open an issue](https://github.com/git-zodyac/illuma/issues) on GitHub.
