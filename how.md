app.js : on node server
- term : pty spawn running on host ; events:  'data'
- ws : webSocket; events : 'message', 'close'
term.data -> ws.send
ws.message -> term.write
ws.close -> term.kill
POST /terminals
  create term
  return pid
POST /terminals/:pid/size
  term.resize


main.js : client side
- term : instance of Terminal class ; event: 'resize', 'data'
- socket: webSocket; events: 'open', 'close', 'error', 'message'
term.attach(socket)
  - socket.message -> term.write
  - term.data -> socket.send
  - term.resize -> POST /terminals/:pid/size
  - socket.close -> term.detach
  - socket.error -> term.detach
  - socket.open -> term.attach
init
  instantiate term from Terminal
  POST /terminals
  open socket
  term.attach(socket)
