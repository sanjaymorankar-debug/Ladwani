/** F37 bureau profile fields, validated (they were stored unchecked before). */
export function profileFields(body: any): { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = {}
  const text = (k: string, max: number) => {
    if (body[k] === undefined) return
    const v = body[k] === null ? null : String(body[k]).trim()
    if (v && v.length > max) throw new Error(`${k} is too long (max ${max})`)
    data[k] = v || null
  }
  try {
    text('about', 2000); text('expectations', 2000); text('horoscope', 2000)
  } catch (e: any) { return { error: e.message } }
  if (body.heightCm !== undefined) {
    const h = body.heightCm === null || body.heightCm === '' ? null : Number(body.heightCm)
    if (h !== null && (!Number.isInteger(h) || h < 100 || h > 250)) return { error: 'Height must be in centimetres (100–250)' }
    data.heightCm = h
  }
  if (body.contactPreference !== undefined) {
    if (body.contactPreference !== null && !['SELF', 'KARTA', 'BOTH'].includes(body.contactPreference)) return { error: 'Contact preference must be SELF, KARTA or BOTH' }
    data.contactPreference = body.contactPreference
  }
  if (body.languages !== undefined) {
    if (!Array.isArray(body.languages) || body.languages.some((l: unknown) => typeof l !== 'string')) return { error: 'Languages must be a list' }
    data.languages = body.languages.slice(0, 10)
  }
  return { data }
}
