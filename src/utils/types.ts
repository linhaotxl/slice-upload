const toString = Object.prototype.toString
const toRawType = (value: unknown) => toString.call(value)
const toType = (value: unknown) => toRawType(value).slice(8, -1)

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number'

export const isString = (value: unknown): value is string =>
  typeof value === 'string'

export const isFunction = (value: unknown): value is (...args: any) => any =>
  typeof value === 'function'

export const isPlainObject = (value: unknown): value is Record<string, any> =>
  toType(value) === 'Object'

export const isFormData = (value: unknown): value is FormData =>
  toType(value) === 'FormData'

export const isObject = (value: unknown): value is Record<any, any> =>
  typeof value === 'object' && value !== null

export const isPromise = <T = any>(value: unknown): value is Promise<T> =>
  isObject(value) && isFunction(value.then) && isFunction(value.catch)

export const isError = (value: unknown): value is Error =>
  toType(value) === 'Error'
