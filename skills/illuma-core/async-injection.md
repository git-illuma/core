# Async Injection & Sub-containers

For lazy-loading heavy modules or creating isolated sub-containers, use the async injection utilities.

## `injectAsync` — lazy single dependency

```typescript
import { injectAsync } from '@illuma/core';

@NodeInjectable()
class ReportService {
  private readonly _getPdfEngine = injectAsync(
    () => import('./pdf-engine').then(m => m.PdfEngine),
  );

  async generateReport(): Promise<Buffer> {
    const engine = await this._getPdfEngine();
    return engine.render();
  }
}
```

By default the result is cached. Pass `{ withCache: false }` to create a new instance each call.

## `injectEntryAsync` — sub-container with a specific entrypoint

```typescript
import { injectEntryAsync } from '@illuma/core';

@NodeInjectable()
class AppService {
  private readonly _getReport = injectEntryAsync(
    async () => import('./reports').then(m => m.ReportService),
    { config: [Logger, PdfEngine] },
  );

  async run(): Promise<void> {
    const report = await this._getReport();
    report.generate();
  }
}
```

## `injectGroupAsync` — sub-container exposing a full injector

```typescript
import { injectGroupAsync } from '@illuma/core';

@NodeInjectable()
class PluginHost {
  private readonly _getPluginInjector = injectGroupAsync({
    config: [PluginA, PluginB],
  });

  async executePlugins(): Promise<void> {
    const injector = await this._getPluginInjector();
    injector.get(PluginA).run();
  }
}
```
