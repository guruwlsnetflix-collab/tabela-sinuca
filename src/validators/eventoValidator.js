const { body } = require('express-validator')

const eventoValidators = {
  criar: [
    body('nome')
      .trim()
      .notEmpty().withMessage('O nome do evento é obrigatório.')
      .isLength({ max: 120 }).withMessage('O nome deve ter no máximo 120 caracteres.'),
    body('data_inicio')
      .notEmpty().withMessage('A data de início é obrigatória.')
      .isISO8601().withMessage('Data de início inválida.'),
    body('data_fim')
      .notEmpty().withMessage('A data de fim é obrigatória.')
      .isISO8601().withMessage('Data de fim inválida.')
      .custom((value, { req }) => {
        if (value < req.body.data_inicio) {
          throw new Error('A data de fim deve ser maior ou igual à data de início.')
        }
        return true
      })
  ],
  atualizar: [
    body('nome')
      .trim()
      .notEmpty().withMessage('O nome do evento é obrigatório.')
      .isLength({ max: 120 }).withMessage('O nome deve ter no máximo 120 caracteres.'),
    body('data_inicio')
      .notEmpty().withMessage('A data de início é obrigatória.')
      .isISO8601().withMessage('Data de início inválida.'),
    body('data_fim')
      .notEmpty().withMessage('A data de fim é obrigatória.')
      .isISO8601().withMessage('Data de fim inválida.')
      .custom((value, { req }) => {
        if (value < req.body.data_inicio) {
          throw new Error('A data de fim deve ser maior ou igual à data de início.')
        }
        return true
      })
  ],
  status: [
    body('status')
      .notEmpty().withMessage('O status é obrigatório.')
      .isIn(['planejado', 'em_andamento', 'encerrado']).withMessage('Status inválido.')
  ]
}

module.exports = eventoValidators
