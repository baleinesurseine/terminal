var express = require('express')
var app = express()
require('express-ws')(app)
var path = require('path')
var os = require('os')
var pty = require('pty.js')
var basicAuth = require('basic-auth')

var auth = function (req, res, next) {
  function unauthorized (resp) {
    resp.set('WWW-Authenticate', 'Basic realm=Authorization Required')
    return resp.sendStatus(401)
  }
  var user = basicAuth(req)
  if (!user || !user.name || !user.pass) {
    return unauthorized(res)
  }
  if (user.name === process.env.NAME && user.pass === process.env.PASSWD) {
    return next()
  } else {
    return unauthorized(res)
  }
}

var terminals = {}
var logs = {}

app.use('/build', express.static(path.join(__dirname, '/../build')))
app.use('/addons', express.static(path.join(__dirname, '/../addons')))

app.get('/', auth, function (req, res) {
  res.sendFile(path.join(__dirname, '/index.html'))
})

app.get('/style.css', auth, function (req, res) {
  res.sendFile(path.join(__dirname, '/style.css'))
})

app.get('/main.js', auth, function (req, res) {
  res.sendFile(path.join(__dirname, '/main.js'))
})

app.get('/fetch.js', auth, function (req, res) {
  res.sendFile(path.join(__dirname, '/fetch.min.js'))
})

app.post('/terminals', auth, function (req, res) {
  var cols = parseInt(req.query.cols)
  var rows = parseInt(req.query.rows)
  var pid = parseInt(req.query.processID)

  if (isNaN(pid)) { // || !terminals[pid]
    var term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
      name: 'xterm-color',
      cols: cols || 120,
      rows: rows || 48,
      cwd: process.env.HOME,
      env: process.env
    })
    term.on('exit', function () {
      console.log('pty exited pid: ' + term.pid)
    })

    term.on('close', function () {
      console.log('pty closed pid: ' + term.pid)
    })
    console.log('Created terminal with PID: ' + term.pid)

    terminals[term.pid] = term
    logs[term.pid] = ''
    term.on('data', function (data) {
      logs[term.pid] += data
    })
  } else {
    term = terminals[pid]
    logs[term.pid] = ''
  }

  res.send(term.pid.toString())
  res.end()
})

app.post('/terminals/:pid/size', auth, function (req, res) {
  var pid = parseInt(req.params.pid)
  var cols = parseInt(req.query.cols)
  var rows = parseInt(req.query.rows)
  var term = terminals[pid]

  term.resize(cols, rows)
  console.log('Resized terminal ' + pid + ' to ' + cols + ' cols and ' + rows + ' rows.')
  res.end()
})

app.ws('/terminals/:pid', function (ws, req) {
  var term = terminals[parseInt(req.params.pid)]
  console.log('Connected to terminal ' + term.pid)
  ws.send(logs[term.pid])

  term.on('close', function () {
    delete terminals[term.pid]
    delete logs[term.pid]
    ws.close()
  })

  term.on('data', function (data) {
    try {
      ws.send(data)
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  })
  ws.on('message', function (msg) {
    term.write(msg)
  })
})

var port = process.env.PORT || 3000
var host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0'

console.log('App listening to http://' + host + ':' + port)
app.listen(port, host)
