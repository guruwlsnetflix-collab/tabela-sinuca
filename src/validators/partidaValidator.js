const { body } = require('express-validator')

const partidaValidators = {
  criar: [
    body('jogador_a_id').isInt({ min: 1 }).withMessage('Selecione o jogador A.'),
    body('jogador_b_id')
      .isInt({ min: 1 })
      .withMessage('Selecione o jogador B.')
      .custom((value, { req }) => value !== req.body.jogador_a_id)
      .withMessage('O jogador B não pode ser o mesmo que o jogador A.'),
    body('vencedor_id')
      .isInt({ min: 1 })
      .withMessage('Selecione o vencedor.')
      .custom((value, { req }) =>
        value === req.body.jogador_a_id || value === req.body.jogador_b_id
      )
      .withMessage('O vencedor deve ser o jogador A ou o jogador B.'),
    body('data_partida')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Data da partida inválida.')
  ],
  atualizar: [
    body('jogador_a_id').isInt({ min: 1 }).withMessage('Selecione o jogador A.'),
    body('jogador_b_id')
      .isInt({ min: 1 })
      .withMessage('Selecione o jogador B.')
      .custom((value, { req }) => value !== req.body.jogador_a_id)
      .withMessage('O jogador B não pode ser o mesmo que o jogador A.'),
    body('vencedor_id')
      .isInt({ min: 1 })
      .withMessage('Selecione o vencedor.')
      .custom((value, { req }) =>
        value === req.body.jogador_a_id || value === req.body.jogador_b_id
      )
      .withMessage('O vencedor deve ser o jogador A ou o jogador B.'),
    body('data_partida')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Data da partida inválida.')
  ]
}

module.exports = partidaValidators
