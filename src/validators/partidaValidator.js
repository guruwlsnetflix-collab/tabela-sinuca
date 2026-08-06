const { body } = require('express-validator')

const partidaValidators = {
  criar: [
    body('jogador_a_id').isInt({ min: 1 }).withMessage('Selecione o jogador A.'),
    body('jogador_b_id').isInt({ min: 1 }).withMessage('Selecione o jogador B.'),
    body('vencedor_id').isInt({ min: 1 }).withMessage('Selecione o vencedor.'),
    body('data_partida')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Data da partida inválida.')
  ],
  atualizar: [
    body('jogador_a_id').isInt({ min: 1 }).withMessage('Selecione o jogador A.'),
    body('jogador_b_id').isInt({ min: 1 }).withMessage('Selecione o jogador B.'),
    body('vencedor_id').isInt({ min: 1 }).withMessage('Selecione o vencedor.'),
    body('data_partida')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Data da partida inválida.')
  ]
}

module.exports = partidaValidators
