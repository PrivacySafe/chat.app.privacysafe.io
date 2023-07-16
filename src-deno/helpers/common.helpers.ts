/*
 Copyright (C) 2022 3NSoft Inc.

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

 This program is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 this program. If not, see <http://www.gnu.org/licenses/>.
*/

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
