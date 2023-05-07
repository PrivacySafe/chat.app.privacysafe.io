/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types */
import { App, Plugin } from 'vue'
import mitt from 'mitt'

const emitter = mitt()

const $emitter = {
  on: emitter.on.bind(emitter),
  once: (event: string|symbol, handler: Function) => {
    function wrapHandler() {
      emitter.off(event, wrapHandler)
      // eslint-disable-next-line prefer-spread,prefer-rest-params
      handler.apply(null, arguments)
    }
    emitter.on(event, wrapHandler)
  },
  off: emitter.off.bind(emitter),
  emit: emitter.emit.bind(emitter),
  clear: emitter.all.clear.bind(emitter),
}

export const bus: Plugin = {
  install: (app: App) => {
    // @ts-ignore
    app.config.globalProperties.$emitter = $emitter
    app.provide('event-bus', $emitter)
  },
}

declare module '@vue/runtime-core' {
  export interface ComponentCustomProperties {
    $emitter: {
      on: (type: string|symbol, handler: Function) => void;
      off: (type: string|symbol, handler?: Function) => void;
      emit:(type: string|symbol, arguments?: any) => void;
      once: (type: string|symbol, handler: Function) => void;
      clear: () => void;
    },
  }
}
