module.exports = buf => {
  const res = Buffer.alloc(256)
  buf.copy(res, 0)
  return res
}
