const { body } = require('express-validator')

const nomeRules = [
  body('nome')
    .trim()
    .notEmpty().withMessage('O nome do torneio é obrigatório.')
    .isLength({ max: 120 }).withMessage('O nome deve ter no máximo 120 caracteres.')
]

const basicoRules = [
  ...nomeRules,
  body('local')
    .trim()
    .optional({ values: 'falsy' })
    .isLength({ max: 120 }).withMessage('O local deve ter no máximo 120 caracteres.'),
  body('data_inicio')
    .notEmpty().withMessage('A data de início é obrigatória.')
    .isISO8601().withMessage('Data de início inválida.'),
  body('previsao_termino')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Previsão de término inválida.')
    .custom((value, { req }) => {
      if (value && value < req.body.data_inicio) {
        throw new Error('A previsão de término deve ser maior ou igual à data de início.')
      }
      return true
    }),
  body('modalidade')
    .optional({ values: 'falsy' })
    .isIn(['par', 'impar']).withMessage('Modalidade inválida.')
]

const jogadorRules = [
  body('nome')
    .trim()
    .notEmpty().withMessage('O nome do jogador é obrigatório.')
    .isLength({ max: 120 }).withMessage('O nome deve ter no máximo 120 caracteres.'),
  body('apelido').trim().isLength({ max: 60 }).withMessage('O apelido deve ter no máximo 60 caracteres.'),
  body('telefone').trim().isLength({ max: 30 }).withMessage('O telefone deve ter no máximo 30 caracteres.')
]

const torneioValidators = {
  criar: basicoRules,
  atualizar: basicoRules,
  jogador: jogadorRules
}

module.exports = torneioValidators