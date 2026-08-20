const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')

ctx.fillStyle = '#222'
ctx.fillRect(0, 0, canvas.width, canvas.height)
ctx.fillStyle = '#fff'
ctx.font = '16px monospace'
ctx.fillText('canvas vivo', 20, 40)
