import { Injectable, Injector, ProviderToken } from "@angular/core";

@Injectable({ providedIn: 'root' })

export class LazyServiceInjector {
  constructor(private injector: Injector) {}

  async get<T>(providerLoader: () => Promise<ProviderToken<T>>) {
    return this.injector.get(await providerLoader());
  }
}