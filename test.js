const cluster = require('cluster')

if (cluster.isMaster) {
  for (let i = 0; i < 16; ++i) {
    cluster.fork()
  }

  const range = (start, endExclusive) => {
    const result = []
    for (let i = start; i < endExclusive; ++i) {
      result.push(i)
    }
    return result
  }

  const encode = async numbers => {
    const promises = []

    let i = 0
    const ii = Math.ceil(numbers.length / 32)

    for (const id in cluster.workers) {
      const worker = cluster.workers[id]
      const chunk = numbers.slice(i * ii, (i + 1) * ii)

      promises.push(new Promise(resolve => {
        worker.once('message', msg => {
          resolve(JSON.parse(msg))
        })
      }))

      worker.send(JSON.stringify(chunk))

      ++i
    }

    const results = await Promise.all(promises)

    return results.reduce(
      (a, r) => {
        a.push(...r)
        return a
      },
      []
    )
  }

  const main = async () => {
    const count = Math.pow(10, 7) - Math.pow(10, 6)

    const encoded = []

    for (let i = 0; i < count; i += 320) {
      const chunk = range(i, Math.min(i + 320, count))
      encoded.push(...await encode(chunk))

      console.log(`encoded ${encoded.length} numbers`)
    }

    const map = new Map()
    for (let i = 0; i < encoded.length; i += 320) {
      const chunk = range(i, Math.min(i + 320, encoded.length))
      const verify = await encode(chunk)

      verify.forEach((e, j) => {
        const n = i + j
        if (e !== encoded[n]) {
          console.error(`Unstable (n: ${n}, e1: ${encoded[n]}, e2: ${e})`)
        }

        if (map.has(e)) {
          console.error(`Violating (n: ${n}, e: ${e}, n(e): ${map.get(e)})`)
        }

        map.set(e, n)
      })

      console.log(`verified ${Math.min(i + 320, encoded.length)}`)
    }
  }

  main().then(null, err => console.error(err))
} else {
  const enc = require('./enc')

  process.on('message', msg => {
    const numbers = JSON.parse(msg)
    const encoded = numbers.map(enc)
    process.send(JSON.stringify(encoded))
  })
}
