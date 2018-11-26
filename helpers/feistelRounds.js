const feistelRound = require('./feistelRound')
const intToBuffer = require('./intToBuffer')

module.exports = (num, key, numRounds) => {
  let buf = intToBuffer(num)
  for (let i = 0; i < numRounds; ++i) {
    buf = feistelRound(buf, `${key}#${i}`, 4)
  }
  return buf
}
