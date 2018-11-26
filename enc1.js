const feistelRounds = require('./helpers/feistelRounds')

module.exports = num => {
  const key = 'key'

  do {
    const buf = feistelRounds(num, key, 4)
    num = buf.readUInt32LE()
  } while (num > 899999)

  return num
}
