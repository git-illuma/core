# 🔗 Async Injection & Sub-Containers

This guide covers advanced dependency injection patterns using `injectAsync`, `injectGroupAsync`, and `injectEntryAsync` for lazy-loading dependencies and managing sub-containers.

## Table of contents

- [🔗 Async Injection \& Sub-Containers](#-async-injection--sub-containers)
  - [Table of contents](#table-of-contents)
  - [Overview](#overview)
  - [injectAsync](#injectasync)
    - [Basic usage](#basic-usage)
    - [Use cases](#use-cases)
      - [Code splitting \& Lazy loading](#code-splitting--lazy-loading)
      - [Conditional Dependencies](#conditional-dependencies)
    - [Type safety](#type-safety)
    - [Caching behavior](#caching-behavior)
    - [Overriding dependencies](#overriding-dependencies)
  - [injectEntryAsync](#injectentryasync)
    - [Basic usage](#basic-usage-1)
    - [When to use](#when-to-use)
  - [injectGroupAsync](#injectgroupasync)
    - [Basic usage](#basic-usage-2)
    - [Parent-Child relationships](#parent-child-relationships)
    - [Caching behavior](#caching-behavior-1)
    - [Overriding dependencies](#overriding-dependencies-1)
  - [Common patterns](#common-patterns)
    - [Plugin Systems](#plugin-systems)
    - [Feature modules](#feature-modules)
    - [Request-Scoped Containers](#request-scoped-containers)
  - [Best practices](#best-practices)
    - [✅ Do's](#-dos)
    - [❌ Don'ts](#-donts)
  - [Performance considerations](#performance-considerations)
    - [Lazy Loading Benefits](#lazy-loading-benefits)
    - [Caching impact](#caching-impact)
    - [Memory considerations](#memory-considerations)
  - [Related documentation](#related-documentation)

## Overview

Illuma provides three utilities for advanced async dependency injection:

| Utility | Purpose | Returns |
|---------|---------|---------|
| `injectAsync` | Lazily inject a single dependency | The dependency instance |
| `injectEntryAsync` | Create sub-container and resolve specific entrypoint | The entrypoint instance |
| `injectGroupAsync` | Create isolated sub-container with array of providers | An injector |

**Note:** For synchronous deferred injection (e.g. to solve circular dependencies without async/await), use [`injectDefer`](./API.md#injectDefer) instead.

All utilities support:
- ✅ Async factory functions
- ✅ Dynamic imports for code splitting
- ✅ Optional caching
- ✅ Full type inference
- ✅ Dependency overrides
- ✅ Parent container access

## injectAsync

`injectAsync` creates a function that lazily resolves a single dependency. The dependency is provided in a temporary sub-container that inherits from the parent.

### Basic usage

```typescript
import { injectAsync, NodeInjectable } from '@illuma/core';

@NodeInjectable()
class UserService {
  // Lazy-load a heavy analytics module
  private readonly getAnalytics = injectAsync(
    () => import('./analytics').then((m) => m.AnalyticsService)
  );

  public async trackUserAction(userId: string, action: string) {
    // Analytics module is only loaded when this method is called
    const analytics = await this.getAnalytics();
    analytics.track(userId, action);
  }
}
```

### Use cases

#### Code splitting & Lazy loading

Reduce initial bundle size by loading heavy dependencies on-demand:

```typescript
@NodeInjectable()
class ReportGenerator {
  private readonly getPdfEngine = injectAsync(
    () => import('./pdf-engine').then((m) => m.PdfEngine)
  );

  public async generateReport(data: ReportData) {
    const pdf = await this.getPdfEngine();
    return pdf.generate(data);
  }
}
```

#### Conditional Dependencies

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

  public async save(key: string, data: any) {
    const storage = await this.getStorage();
    return storage.save(key, data);
  }
}
```

### Type safety

`injectAsync` provides full type inference:

```typescript
// Single token - infers Logger
const getLogger = injectAsync(async () => Logger);
const logger = await getLogger();

// Multi-token - infers Plugin[]
const PLUGINS = new MultiNodeToken<Plugin>('PLUGINS');
const getPlugins = injectAsync(async () => PLUGINS);
const plugins = await getPlugins();

// Constructor - infers MyService
const getService = injectAsync(async () => MyService);
const service = await getService();
```

### Caching behavior

By default, `injectAsync` caches the result:

```typescript
@NodeInjectable()
class MyService {
  private readonly getAnalytics = injectAsync(async () => AnalyticsService);

  public async method1() {
    const analytics = await this.getAnalytics(); // Creates instance
  }

  public async method2() {
    const analytics = await this.getAnalytics(); // Returns cached instance
  }
}
```

To disable caching:

```typescript
private readonly getAnalytics = injectAsync(
  async () => AnalyticsService,
  { withCache: false } // Creates new instance each time
);
```

### Overriding dependencies

Provide additional dependencies or override parent container values:

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
  private readonly getApiService = injectAsync(
    async () => ApiService,
    {
      overrides: [
        { provide: API_URL, value: 'https://api.example.com' },
        { provide: CONFIG_TOKEN, value: { timeout: 5000 } }
      ]
    }
  );

  public async makeRequest() {
    const api = await this.getApiService();
    // api has access to both API_URL and CONFIG_TOKEN
  }
}
```

> **Important**: If both the main provider and overrides provide the same token, a duplicate provider error will be thrown.

## injectEntryAsync

`injectEntryAsync` is similar to `injectGroupAsync` but specifically designed to return a resolved instance of an entrypoint token from the created sub-container.

### Basic usage

```typescript
import { injectEntryAsync, NodeInjectable } from '@illuma/core';

@NodeInjectable()
class Logger {
  log(msg: string) { console.log(msg); }
}

@NodeInjectable()
class ReportService {
  constructor(private logger: Logger) {}
  
  generate() {
    this.logger.log('Generating report...');
    return 'Report Data';
  }
}

@NodeInjectable()
class AppService {
  // Lazily load ReportService and its dependencies
  private readonly getReportService = injectEntryAsync(async () => {
    // You can use dynamic imports here
    // const { ReportService, Logger } = await import('./report');
    return {
      entrypoint: ReportService,
      providers: [ReportService, Logger]
    };
  });

  public async downloadReport() {
    // Creates sub-container, resolves ReportService with Logger injected
    const reportService = await this.getReportService();
    return reportService.generate();
  }
}
```

### When to use

Use `injectEntryAsync` when you want to:
1.  Create a sub-container with multiple providers
2.  Immediately resolve a specific service from that sub-container
3.  Avoid manually getting the injector and calling `get()`

```typescript
// With injectGroupAsync
const getContainer = injectGroupAsync(() => [Service, Helper]);
const injector = await getContainer();
const service = injector.get(Service);

// With injectEntryAsync
const getService = injectEntryAsync(() => ({
  entrypoint: Service,
  providers: [Service, Helper]
}));
const service = await getService();
```

## injectGroupAsync

`injectGroupAsync` creates an isolated sub-container with its own dependency tree using an array of providers. This is the recommended approach for sub-containers.

### Basic usage

```typescript
import { injectGroupAsync, NodeInjectable, NodeToken } from '@illuma/core';

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

  public async executeFeature() {
    const injector = await this.getFeatureInjector();
    const service = injector.get(FEATURE_SERVICE);
    service.execute();
  }
}
```

### Parent-Child relationships

Sub-containers inherit from their parent container:

```typescript
// Parent container
const parentContainer = new NodeContainer();
parentContainer.provide([Logger, Config]);
parentContainer.bootstrap();

// Service in parent
@NodeInjectable()
class ParentService {
  private readonly getChildInjector = injectGroupAsync(async () => {
    return [
      ChildService // Can inject Logger and Config from parent
    ];
  });
}

@NodeInjectable()
class ChildService {
  private readonly logger = nodeInject(Logger);  // From parent
  private readonly config = nodeInject(Config);  // From parent
}
```

### Caching behavior

Like `injectAsync`, sub-containers are cached by default:

```typescript
@NodeInjectable()
class FeatureHost {
  private readonly getFeatureInjector = injectGroupAsync(
    async () => [/* providers */]
  );

  public async method1() {
    const injector = await this.getFeatureInjector(); // Creates sub-container
  }

  public async method2() {
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

### Overriding dependencies

Provide dependencies to the sub-container:

```typescript
const DATABASE_URL = new NodeToken<string>('DATABASE_URL');

@NodeInjectable()
class AppService {
  private readonly getDataModule = injectGroupAsync(
    async () => {
      const { DataService } = await import('./data-module');
      return [DataService];
    },
    {
      overrides: [
        { provide: DATABASE_URL, value: 'postgresql://localhost/mydb' }
      ]
    }
  );
}
```

Note: As with `injectAsync`, providing the same token in both the main providers and overrides will result in a duplicate provider error.

## Common patterns

### Plugin Systems

```typescript
interface Plugin {
  name: string;
  execute(): void;
}

const PLUGIN = new MultiNodeToken<Plugin>('PLUGIN');

@NodeInjectable()
class PluginHost {
  private readonly getPluginContainer = injectGroupAsync(
    () => import('./plugins').then((m) => m.providePlugins())
  );

  public async executePlugins() {
    const injector = await this.getPluginContainer();
    const plugins = injector.get(PLUGIN);
    plugins.forEach(p => p.execute());
  }
}
```

### Feature modules

```typescript
// feature-tokens.ts
export const FEATURE_SERVICE = new NodeToken<FeatureService>('FEATURE_SERVICE');
export const FEATURE_CONFIG = new NodeToken<FeatureConfig>('FEATURE_CONFIG');

// feature-providers.ts
export function provideFeature() {
  return [
    { provide: FEATURE_SERVICE, useClass: FeatureService },
    { provide: FEATURE_CONFIG, value: { enabled: true } }
  ];
}

// app.ts
@NodeInjectable()
class Application {
  private readonly getFeatureModule = injectGroupAsync(
    () => import('./feature-providers').then((m) => m.provideFeature())
  );

  public async loadFeature() {
    const injector = await this.getFeatureModule();
    const service = injector.get(FEATURE_SERVICE);
    service.initialize();
  }
}
```

### Request-Scoped Containers

```typescript
interface RequestContext {
  userId: string;
  requestId: string;
}

const REQUEST_CONTEXT = new NodeToken<RequestContext>('REQUEST_CONTEXT');

@NodeInjectable()
class RequestHandler {
  public createRequestScope(userId: string, requestId: string) {
    return injectGroupAsync(async () => [
      RequestService,
      { provide: REQUEST_CONTEXT, value: { userId, requestId } }
    ], { withCache: false }); // New scope per request
  }

  public async handleRequest(userId: string, requestId: string) {
    const getInjector = this.createRequestScope(userId, requestId);
    const injector = await getInjector();
    const service = injector.get(RequestService);
    return service.process();
  }
}
```

## Best practices

### ✅ Do's

1. **Use for Code Splitting**
   ```typescript
   private readonly getReportEngine = injectAsync(async () => {
     const { ReportEngine } = await import('./heavy-report-engine');
     return ReportEngine;
   });
   ```

2. **Cache by Default** - Prevents multiple instantiations
   
3. **Use Sub-Containers for Isolation**
   ```typescript
   private readonly getPluginContext = injectGroupAsync(
     async () => [/* plugin providers */]
   );
   ```

4. **Define Tokens in Separate Files** - Prevents leaking unwanted code into main bundle

### ❌ Don'ts

1. **Don't Overuse** - Use regular `nodeInject` for simple dependencies
   ```typescript
   // ❌ Unnecessary
   private readonly getLogger = injectAsync(async () => Logger);
   
   // ✅ Better
   private readonly logger = nodeInject(Logger);
   ```

2. **Don't Create Circular Dependencies**
   ```typescript
   // ❌ Circular via async injection
   class ServiceA {
     private readonly getB = injectAsync(async () => ServiceB);
   }
   class ServiceB {
     private readonly getA = injectAsync(async () => ServiceA);
   }
   ```

3. **Don't Disable Caching Unnecessarily**
   ```typescript
   // ❌ Creates new instance every time (unless intentional)
   private readonly getService = injectAsync(
     async () => ExpensiveService,
     { withCache: false }
   );
   ```

## Performance considerations

### Lazy Loading Benefits

```typescript
// Initial bundle: ~100KB
// Report engine: ~500KB (only loaded when needed)

@NodeInjectable()
class ReportService {
  private readonly getReportEngine = injectAsync(
    () => import('./report-engine').then((m) => m.ReportEngine)
  );

  public async generateReport() {
    const engine = await this.getReportEngine(); // Loaded on-demand
    return engine.generate();
  }
}
```

### Caching impact

```typescript
// Without cache: ~10ms overhead each call
// With cache: ~0ms after first call
```

### Memory considerations

Cached instances remain in memory until the parent service is garbage collected:

```typescript
@NodeInjectable()
class LongLivedService {
  // Sub-container lives until LongLivedService is garbage collected
  private readonly getHeavyModule = injectGroupAsync(
    async () => heavyModuleProviders
  );
}
```

## Related documentation

- [Getting Started](./GETTING_STARTED.md) - Basic setup and concepts
- [Providers Guide](./PROVIDERS.md) - Provider types
- [API Reference](./API.md) - Complete API documentation
- [Testing Guide](./TESTKIT.md) - Testing with Illuma
