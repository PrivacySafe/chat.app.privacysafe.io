import { isEmpty } from 'lodash'

export function getDeliveryErrors(progress: web3n.asmail.DeliveryProgress) {
  const { recipients } = progress
  return Object.keys(recipients).reduce((res, recipient) => {
    const { err } = recipients[recipient]
    if (!isEmpty(err) && 'runtimeException' in err ) {
      const { type } = err
      res[recipient] = type!
    }
    return res
  }, {} as Record<string, string>)
}

export function getRandomId(numOfChars: number): string {
  if (numOfChars < 1) { throw new Error(`number of chars is less than one`); }

  const possibleCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(numOfChars * 2);
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < array.length; i++) {
    result += possibleCharacters.charAt(array[i] % 62)
  }
  return result.slice(0, numOfChars)
}

export async function transformFileToWeb3NFile(file: File): Promise<web3n.files.File | undefined> {
  const { path } = file as File & { path: string }
  const fsItemCollection = await w3n.storage!.getSysFS!('device', path)
  const { isFile, item } = fsItemCollection
  return isFile && item ? item as web3n.files.File : undefined
}
