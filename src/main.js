const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')

function resize() {
  canvas.width = innerWidth
  canvas.height = innerHeight
  draw()
}

function draw() {
  ctx.fillStyle = '#222'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fff'
  ctx.font = '16px monospace'
  ctx.fillText('canvas vivo ' + canvas.width + 'x' + canvas.height, 20, 40)
}

addEventListener('resize', resize)
resize()
