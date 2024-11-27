export function randomStr(numOfChars: number): string {
  if (numOfChars < 1) {
    throw new Error(`number of chars is less than one`);
  }

  const possibleCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(numOfChars * 2);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < array.length; i++) {
    result += possibleCharacters.charAt(array[i] % 62);
  }
  return result.slice(0, numOfChars);

}
