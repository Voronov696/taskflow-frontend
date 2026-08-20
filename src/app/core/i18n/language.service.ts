import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'en' | 'fr';

const STORAGE_KEY = 'lang';
const DEFAULT_LANGUAGE: AppLanguage = 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {

  constructor(private translate: TranslateService) {
    this.translate.addLangs(['en', 'fr']);
    this.translate.use(this.getLanguage());
  }

  setLanguage(lang: AppLanguage): void {
    this.translate.use(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  getLanguage(): AppLanguage {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'fr' ? 'fr' : DEFAULT_LANGUAGE;
  }

  /** BCP47 tag for native Intl calls (toLocaleDateString, etc). */
  getIntlLocale(): string {
    return this.getLanguage() === 'fr' ? 'fr-FR' : 'en-GB';
  }

  /** Locale id for Angular's DatePipe — 'fr' requires registerLocaleData(localeFr); English uses the built-in default. */
  getAngularLocale(): string | undefined {
    return this.getLanguage() === 'fr' ? 'fr' : undefined;
  }
}
