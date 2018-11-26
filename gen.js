const fs = require('fs')
const enc = require('./enc')

let ab = []
for (let i = 100000; i < 1000000; ++i) {
  ab.push([i, Math.random()])
}
ab.sort((a, b) => a[1] - b[1])
ab = ab.map(([a, b]) => a)

const stream = fs.createWriteStream('out.bin')
stream.on('error', err => console.error(err))

for (let i = 0; i < 1000000 - 100000; ++i) {
  const buffer = new Buffer([0, 0, 0, 0, 0, 0, 0, 0])
  buffer.writeInt32BE(i)
  buffer.writeInt32BE(ab[i], 4)
  stream.write(buffer)
}

function gen(length) {
  const a1 = []
  for (let i = Math.pow(10, length), ii = Math.pow(10, length + 1); i < ii; ++i) {
    a1.push([i, Math.random()])
  }
  a1.sort((a, b) => a[1] - b[1])

  const a2 = a1.map(x => x[0])

  for (let i = )
}
