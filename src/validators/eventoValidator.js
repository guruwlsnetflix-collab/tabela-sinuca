const { body } = require('express-validator')

const SENHA_MIN = 6
const SENHA_MAX = 60

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
      }),
    body('valor_aposta_padrao')
      .optional({ values: 'falsy' })
      .isFloat({ min: 0 }).withMessage('O valor da aposta padrão deve ser um número maior ou igual a zero.'),
    body('senha')
      .trim()
      .notEmpty().withMessage('A senha do evento é obrigatória.')
      .isLength({ min: SENHA_MIN, max: SENHA_MAX })
      .withMessage(`A senha deve ter entre ${SENHA_MIN} e ${SENHA_MAX} caracteres.`)
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
      }),
    body('valor_aposta_padrao')
      .optional({ values: 'falsy' })
      .isFloat({ min: 0 }).withMessage('O valor da aposta padrão deve ser um número maior ou igual a zero.'),
    body('senha')
      .optional({ values: 'falsy' })
      .isLength({ min: SENHA_MIN, max: SENHA_MAX })
      .withMessage(`A senha deve ter entre ${SENHA_MIN} e ${SENHA_MAX} caracteres.`)
  ],
  status: [
    body('status')
      .notEmpty().withMessage('O status é obrigatório.')
      .isIn(['planejado', 'em_andamento', 'encerrado']).withMessage('Status inválido.')
  ]
}

module.exports = eventoValidators
