const { body } = require('express-validator')

const jogadorValidators = {
  criar: [
    body('nome')
      .trim()
      .notEmpty().withMessage('O nome do jogador é obrigatório.')
      .isLength({ max: 120 }).withMessage('O nome deve ter no máximo 120 caracteres.'),
    body('apelido').trim().isLength({ max: 60 }).withMessage('O apelido deve ter no máximo 60 caracteres.'),
    body('telefone').trim().isLength({ max: 30 }).withMessage('O telefone deve ter no máximo 30 caracteres.')
  ],
  atualizar: [
    body('nome')
      .trim()
      .notEmpty().withMessage('O nome do jogador é obrigatório.')
      .isLength({ max: 120 }).withMessage('O nome deve ter no máximo 120 caracteres.'),
    body('apelido').trim().isLength({ max: 60 }).withMessage('O apelido deve ter no máximo 60 caracteres.'),
    body('telefone').trim().isLength({ max: 30 }).withMessage('O telefone deve ter no máximo 30 caracteres.')
  ]
}

module.exports = jogadorValidators
