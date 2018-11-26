const crypto = require('crypto')
const padBuffer = require('./padBuffer')

module.exports = (key, data, len) => {
  const cipher = crypto.createCipher('aes-256-cbc', key)
  cipher.setAutoPadding(false)
  const input = padBuffer(data)
  const out1 = cipher.update(input)
  const out2 = cipher.final()
  const out = Buffer.concat([out1, out2])
  return out.slice(0, len)
}
