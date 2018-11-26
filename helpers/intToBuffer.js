module.exports = num => {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(num)
  return buf
}
