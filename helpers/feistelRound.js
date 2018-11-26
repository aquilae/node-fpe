const roundFunction = require('./roundFunction')
const xorBuffer = require('./xorBuffer')

module.exports = (buf, key, len) => {
  const left = buf.slice(0, len / 2)
  const right = buf.slice(len / 2)

  const nextLeft = right
  const roundedRight = roundFunction(key, right, len / 2)
  const nextRight = xorBuffer(left, roundedRight, len / 2)

  return Buffer.concat([nextLeft, nextRight])
}
