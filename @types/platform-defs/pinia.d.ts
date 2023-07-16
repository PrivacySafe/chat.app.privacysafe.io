/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any */
import 'pinia'

declare module 'pinia' {
  export interface PiniaCustomProperties {
    $emitter: {
      on: (type: string|symbol, handler: Function) => void;
      off: (type: string|symbol, handler?: Function) => void;
      emit:(type: string|symbol, arguments?: any) => void;
      once: (type: string|symbol, handler: Function) => void;
      clear: () => void;
    }
    $i18n: {
      locale: string;
      changeLocale: (lang: string) => void;
      tr: (key: string, placeholders?: Record<string, string>) => string;
    }
  }
}
