import { colorsMap } from '@/constants'

export function getElementColor(initials = '?'): string {
  const code = initials.length === 1
    ? initials.charCodeAt(0) % 64
    : (initials.charCodeAt(0) + initials.charCodeAt(1)) % 64
  const codeStr = initials[0] === '?' ? '?' : code.toFixed()
  return colorsMap[codeStr]
}

export function invertColor(color: string): string {
  if (color) {
    let tmpColor = color.substring(1)
    let tmpColorNum = parseInt(tmpColor, 16)
    tmpColorNum = 0xFFFFFF ^ tmpColorNum
    tmpColor = tmpColorNum.toString(16)
    tmpColor = ('00000' + tmpColor).slice(-6)
    tmpColor = `#${tmpColor}`
    return tmpColor
  }
  return '#000'
}
