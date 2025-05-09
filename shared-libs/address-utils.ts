/*
 Copyright (C) 2024 - 2025 3NSoft Inc.

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

export function areAddressesEqual(a: string, b: string): boolean {
  const canonicalA = toCanonicalAddress(a);
  if (!canonicalA) {
    return false;
  }
  const canonicalB = toCanonicalAddress(b);
  if (!canonicalB) {
    return false;
  }
  return (canonicalA === canonicalB);
}

const whiteSpace = /\s/g;

export function toCanonicalAddress(address: string): string {
  if (!address) {
    throw new Error(`Value is not an address`);
  }
  const indOfAt = address.indexOf('@');
  let user: string;
  let domain: string;
  if (indOfAt < 0) {
    domain = address;
    user = '';
  } else {
    domain = address.substring(indOfAt + 1);
    user = address.substring(0, indOfAt).replace(whiteSpace, '');
  }
  return (user + '@' + domain).toLowerCase();
}

export function includesAddress(arr: string[], address: string): boolean {
  const canonAddr = toCanonicalAddress(address);
  return arr.map(toCanonicalAddress).includes(canonAddr);
}
