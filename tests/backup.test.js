import { describe, it, expect } from 'vitest'

const fs = require('fs')
const os = require('os')
const path = require('path')
const Database = require('better-sqlite3')

const { fazerBackup } = require('../src/db/backup')
const EventoService = require('../src/services/eventoService')

describe('Backup do banco', () => {
  it('gera uma cópia legível com os dados atuais', async () => {
    EventoService.criar({ nome: 'Evento do backup', data_inicio: '2026-10-01', data_fim: '2026-10-01' })
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sinuca-backup-'))

    const destino = await fazerBackup(dir)

    const copia = new Database(destino, { readonly: true })
    const evento = copia.prepare('SELECT nome FROM eventos WHERE nome = ?').get('Evento do backup')
    copia.close()
    expect(evento).toEqual({ nome: 'Evento do backup' })
  })
})
