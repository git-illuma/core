# Error Reference

| Code   | Meaning                | Quick fix                                           |
| ------ | ---------------------- | --------------------------------------------------- |
| `i100` | Duplicate provider     | Remove duplicate or use `MultiNodeToken`            |
| `i101` | Duplicate factory      | Only provide one factory per token                  |
| `i102` | Invalid constructor    | Add `@NodeInjectable()` or `makeInjectable`         |
| `i103` | Invalid provider       | Use valid provider shape                            |
| `i200` | Invalid alias          | Alias target must be a token or injectable class    |
| `i201` | Loop alias             | Alias must not point to itself                      |
| `i202` | Conflicting strategies | Don't use `self` and `skipSelf` together            |
| `i300` | Not bootstrapped       | Call `bootstrap()` before `get()`                   |
| `i301` | Already bootstrapped   | Call `provide()` before `bootstrap()`               |
| `i302` | Double bootstrap       | Only call `bootstrap()` once                        |
| `i303` | Container destroyed    | Do not use a destroyed container                    |
| `i400` | Provider not found     | Register the token or use `{ optional: true }`      |
| `i401` | Circular dependency    | Refactor to remove the cycle                        |
| `i500` | Untracked injection    | Use `nodeInject` only in class field initializers   |
| `i501` | Outside context        | Use `nodeInject` only inside factories/constructors |
