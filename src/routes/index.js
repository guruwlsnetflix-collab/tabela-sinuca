const express = require('express')

const router = express.Router()

const db = require('../db')

router.get('/', (req, res) => {
  const eventos = db
    .prepare('SELECT id, nome, data_inicio, data_fim, status FROM eventos ORDER BY data_inicio DESC, id DESC')
    .all()

  res.render('pages/home', {
    eventos,
    title: 'Tabela de Sinuca'
  })
})

module.exports = router
