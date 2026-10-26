import { describe, it, expect } from 'vitest'

const { formatarData, formatarPeriodo } = require('../src/utils/formatacao')

describe('Formatação', () => {
  it('formata datas ISO no padrão brasileiro', () => {
    expect(formatarData('2026-09-24')).toBe('24/09/2026')
    expect(formatarData('2026-09-24 18:30:00')).toBe('24/09/2026')
    expect(formatarData(null)).toBe('')
    expect(formatarData('amanhã')).toBe('amanhã')
  })

  it('formata períodos de forma compacta', () => {
    expect(formatarPeriodo('2026-09-24', '2026-09-24')).toBe('24/09/2026')
    expect(formatarPeriodo('2026-09-24', null)).toBe('24/09/2026')
    expect(formatarPeriodo('2026-09-24', '2026-09-26')).toBe('24/09 – 26/09/2026')
    expect(formatarPeriodo('2026-12-30', '2027-01-02')).toBe('30/12/2026 – 02/01/2027')
  })
})
