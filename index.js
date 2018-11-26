const cluster = require('cluster')

if (cluster.isMaster) {
  const fs = require('fs')
  const http = require('http')

  const range = (min, max) => {
    const result = []
    for (let n = min; n <= max; ++n) {
      result.push(n)
    }
    return result
  }

  const split1 = (array, numChunks) => {
    const result = []

    for (let i = 0; i < numChunks; ++i) {
      result.push([])
    }

    array.forEach((x, i) => {
      result[i % numChunks].push(x)
    })

    return result
  }

  const split2 = (array, maxCount) => {
    let chunk
    const result = []

    for (let i = 0, j = 0, ii = array.length; i < ii; ++i) {
      const item = array[i]

      if (j === 0) {
        chunk = []
        result.push(chunk)
        ++j
      } else if (j === maxCount - 1) {
        j = 0
      } else {
        ++j
      }

      chunk.push(item)
    }

    return result
  }

  for (let i = 0; i < 16; ++i) {
    cluster.fork()
  }

  const workers = Object.keys(cluster.workers).map(id => cluster.workers[id])

  const PORT = global.process.env.PORT

  let processing
  let nextProcessingId = 1

  cluster.on('message', (worker, message, handle) => {
    const [id, result] = JSON.parse(message)
    if (processing && processing.id === id && !processing.done) {
      try {
        Object.assign(processing.data, result)
        processing.progress = Object.keys(processing.data).length
        if (processing.max - processing.min + 1 === processing.progress) {
          const pairs = Object.keys(processing.data).map(x => [x, processing.data[x]])
          pairs.sort((a, b) => a[0] - b[0])
          const buf = Buffer.alloc(pairs.length * 8)
          pairs.forEach(([n, e], i) => {
            buf.writeInt32BE(n, i * 8)
            buf.writeInt32BE(e, (i * 8) + 4)
          })
          fs.writeFileSync('data.bin', buf)
          processing.done = true
        }
      } catch (exc) {
        processing.done = true
        processing.errors.push(`Fatal:\r\n${exc.message}\r\n\r\n${exc}\r\n\r\n${exc.stack}`)
      }
    }
  })

  const process = proc => {
    try {
      const numbers = range(proc.min, proc.max)

      const numbersByWorker = split1(numbers, workers.length)

      workers.forEach((worker, i) => {
        const numbersOfThisWorker = numbersByWorker[i]

        for (const chunk of split2(numbersOfThisWorker, 10)) {
          worker.send(JSON.stringify([proc.id, proc.numRounds, proc.cipherFunc, chunk]))
        }
      })
    } catch (exc) {
      proc.done = true
      proc.errors.push(`Fatal error:\r\n${exc.message}\r\n${exc}\r\n${exc.stack}`)
    }
  }

  const startRx = /^\/start\/(\d+?)\/(\d+?)\/(\d+?)\/(.+?)($|\/.*|\?.*)/

  const start = ({ req, res, match }) => {
    const min = Number(match[1])
    const max = Number(match[2])
    const numRounds = Number(match[3])
    const cipherFunc = match[4]

    const proc = {
      id: nextProcessingId++,
      min,
      max,
      numRounds,
      cipherFunc,
      data: {},
      progress: 0,
      done: false,
      errors: [],
    }

    processing = proc

    process(processing)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(proc))
  }

  const data = ({ res }) => {
    fs.stat('data.bin', (err, stat) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`Error:\r\n${err.message}\r\n${err}\r\n${err.stack}`)
      } else {
        const stream = fs.createReadStream('data.bin')

        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size,
        })

        stream.pipe(res)
      }
    })
  }

  const decode = ({ res }) => {
    fs.readFile('data.bin', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`Error:\r\n${err.message}\r\n${err}\r\n${err.stack}`)
      } else {
        const result = []

        for (let i = 0, ii = data.length; i < ii; i += 8) {
          const n = data.readInt32BE(i)
          const e = data.readInt32BE(i + 4)
          result.push(`${n.toString().padStart(8, ' ')} -> ${e.toString().padStart(8, ' ')}`)
        }

        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(result.join('\r\n'))
      }
    })
  }

  const index = ({ res }) => {
    let body
    if (processing) {
      body = [
        `<div>id: ${processing.id}</div>`,
        `<div>numRounds: ${processing.numRounds}</div>`,
        `<div>cipherFunc: ${processing.cipherFunc}</div>`,
        `<div>min: ${processing.min}</div>`,
        `<div>max: ${processing.max}</div>`,
        `<div>progress: ${processing.progress}</div>`,
        `<div>done: ${processing.done}</div>`,
      ]

      if (processing.errors.length) {
        body.push(
          '<div>errors:</div>',
          '<div>',
          ...processing.errors,
          '</div>',
        )
      } else if (processing.done) {
        body.push('<div><a href="/data">data</a></div>')
      }
    } else {
      body = ['Not started']
    }

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end([
      '<!doctype html>',
      '<html>',
      '<head>',
      '<title>fpe</title>',
      '</head>',
      '<body>',
      ...body,
      '</body>',
      '</html>',
      ''
    ].join(''))
  }

  http
    .createServer((req, res) => {
      const startMatch = startRx.exec(req.url.toString())
      if (startMatch) {
        start({ req, res, match: startMatch })
      } else if (req.url.toString() === '/data') {
        data({ req, res })
      } else if (req.url.toString() === '/decode') {
        decode({ req, res })
      } else {
        index({ req, res })
      }
    })
    .listen(PORT || 34000)
} else {
  const enc = require('./enc')

  process.on('message', msg => {
    const [id, numRounds, cipherFunc, numbers] = JSON.parse(msg)
    const result = {}
    for (const num of numbers) {
      result[num] = enc(num, 100000, 999999, numRounds, cipherFunc)
    }
    process.send(JSON.stringify([id, result]))
  })
}
