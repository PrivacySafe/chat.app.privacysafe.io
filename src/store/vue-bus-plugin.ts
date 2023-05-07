// @ts-ignore
export function vueBusPlugin(context) {
  const { app = {} } = context
  const { config = {} } = app
  const { globalProperties = {} } = config
  const { $emitter } = globalProperties
  return { $emitter }
}
