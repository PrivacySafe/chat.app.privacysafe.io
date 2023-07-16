// @ts-ignore
export function vueBusPlugin(context): { $emitter: EventBus } {
  const { app = {} } = context
  const { config = {} } = app
  const { globalProperties = {} } = config
  const { $emitter } = globalProperties
  return { $emitter }
}
