import { Inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<ThemeMode>('light');

  private initialized = false;

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  initializeTheme(): ThemeMode {
    if (this.initialized) {
      return this.theme();
    }

    const storedTheme = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('sentinel-theme')
      : null;

    let nextTheme: ThemeMode;

    if (storedTheme === 'light' || storedTheme === 'dark') {
      nextTheme = storedTheme;
    } else if (typeof window !== 'undefined' && window.matchMedia) {
      nextTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      nextTheme = 'light';
    }

    this.applyTheme(nextTheme);
    this.initialized = true;

    return nextTheme;
  }

  toggleTheme(): ThemeMode {
    return this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: ThemeMode): ThemeMode {
    this.theme.set(theme);
    this.applyTheme(theme);

    return theme;
  }

  private applyTheme(theme: ThemeMode): void {
    this.document.documentElement.setAttribute('data-theme', theme);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('sentinel-theme', theme);
    }
  }
}