const { validationResult } = require('express-validator')

function coletarErros(req) {
  const result = validationResult(req)
  if (result.isEmpty()) {
    return null
  }
  const erros = {}
  result.array().forEach((e) => {
    erros[e.path] = e.msg
  })
  return erros
}

module.exports = { coletarErros }
