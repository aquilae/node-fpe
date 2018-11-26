const feistelRounds = require('./helpers/feistelRounds')

module.exports = (num, domainStart, domainEnd, numRounds = 4) => {
  const key = 'key'

  const domainSize = domainEnd - domainStart

  do {
    const buf = feistelRounds(num, key, numRounds)
    num = buf.readUInt32LE()
  } while (num > domainSize)

  return domainStart + num
}
