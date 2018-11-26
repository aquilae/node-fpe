const fs = require('fs')
const http = require('http')
const enc = require('./enc')

const PORT = global.process.env.PORT

let processing
let nextProcessingId = 1

const pause = () => new Promise((resolve) => setTimeout(resolve, 0))

const process = async proc => {
  try {
    for (let i = proc.min; proc.run && i <= proc.max; ++i) {
      await pause()
      const enc1 = enc(i, 100000, 999999)
      const enc2 = enc(i, 100000, 999999)

      if (enc1 !== enc2) {
        proc.errors.push(`Mismatch at ${i}: ${enc1}, ${enc2}`)
      }

      if (proc.set[enc1]) {
        proc.errors.push(`Duplicate at ${i}: ${enc1}, ${proc.set[enc1]}`)
      }

      proc.data.push([i, enc1])
      proc.set[enc1] = i
      proc.progress++
    }

    const data = Buffer.alloc(proc.data.length * 8)
    proc.data.forEach(([n, e], i) => {
      data.writeInt32BE(n, i * 8)
      data.writeInt32BE(e, (i * 8) + 4)
    })

    await new Promise((resolve, reject) => {
      fs.writeFile('data.bin', data, err => err ? reject(err) : resolve())
    })
  } catch (exc) {
    proc.errors.push(`Fatal error:\r\n${exc.message}\r\n${exc}\r\n${exc.stack}`)
  } finally {
    proc.run = false
    proc.done = true
  }
}

const startRx = /^\/start\/(\d+?)\/(\d+?)\/(\d+?)($|\/.*|\?.*)/

const start = async ({ req, res, match }) => {
  if (processing) {
    processing.stop()
  }

  const min = Number(match[1])
  const max = Number(match[2])
  const dom = Number(match[3])

  const proc = {
    id: nextProcessingId++,
    min,
    max,
    dom,
    run: true,
    done: false,
    data: [],
    set: {},
    errors: [],
    progress: 0,
  }

  proc.stop = () => proc.run = false

  processing = proc

  process(processing)

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(proc))
}

const stop = ({ res }) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })

  if (processing) {
    processing.stop()
    res.end(`stopped #${processing.id}`)
  } else {
    res.end('nothing to stop')
  }
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

const index = async ({ res }) => {
  let body
  if (processing) {
    body = [
      `<div>id: ${processing.id}</div>`,
      `<div>min: ${processing.min}</div>`,
      `<div>max: ${processing.max}</div>`,
      `<div>dom: ${processing.dom}</div>`,
      `<div>progress: ${processing.progress}</div>`,
      `<div>run: ${processing.run}</div>`,
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
    } else if (req.url.toString() === '/stop') {
      stop({ req, res })
    } else if (req.url.toString() === '/data') {
      data({ req, res })
    } else if (req.url.toString() === '/decode') {
      decode({ req, res })
    } else {
      index({ req, res })
    }
  })
  .listen(PORT || 34000)
