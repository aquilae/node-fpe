module.exports = (a, b, len) => {
  const res = Buffer.alloc(len)
  for (let i = 0; i < len; ++i) {
    res[i] = a[i] ^ b[i]
  }
  return res
}
