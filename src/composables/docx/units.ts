import { convertInchesToTwip, convertMillimetersToTwip } from 'docx'

export const CM_TO_EMU = 914400 / 2.54

export function cmToTwip(cm: number): number {
  return convertInchesToTwip(cm / 2.54)
}

export function ptToHalfPt(pt: number): number {
  return pt * 2
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? ''
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// suppress unused warning for CM_TO_EMU — used conceptually for image dimensions
void CM_TO_EMU
void convertMillimetersToTwip
