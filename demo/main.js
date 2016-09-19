var term
var protocol
var socketURL
var socket
var pid
var charWidth
var charHeight

var wsReset = 0
var wsDate

var terminalContainer = document.getElementById('terminal-container')
var colsElement = document.getElementById('cols')
var rowsElement = document.getElementById('rows')
var pidElement = document.getElementById('pid-container')
var wsElement = document.getElementById('ws-container')

function setTerminalSize () {
  var cols = parseInt(colsElement.value)
  var rows = parseInt(rowsElement.value)
  var width = (cols * charWidth).toString() + 'px'
  var height = (rows * charHeight).toString() + 'px'

  console.log('set terminal size ' + width + ',' + height)
  console.log(cols + ',' + rows)

  terminalContainer.style.width = width
  terminalContainer.style.height = height
  term.resize(cols, rows)
}

colsElement.addEventListener('change', setTerminalSize)
rowsElement.addEventListener('change', setTerminalSize)

createTerminal()

function createTerminal () {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0])
  }
  term = new Terminal({
    cursorBlink: true //  optionElements.cursorBlink.checked
  })
  term.on('resize', function (size) {
    if (!pid) {
      return
    }
    var cols = size.cols
    var rows = size.rows
    var url = '/terminals/' + pid + '/size?cols=' + cols + '&rows=' + rows

    term.cols = cols
    term.rows = rows

    fetch(url, {method: 'GET'})
  })
  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://'
  socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/terminals/'

  term.open(terminalContainer)
  term.fit()

  var initialGeometry = term.proposeGeometry()
  var cols = initialGeometry.cols
  var rows = initialGeometry.rows

  colsElement.value = cols
  rowsElement.value = rows

  term.cols = cols
  term.rows = rows

  fetch('/terminals?cols=' + cols + '&rows=' + rows, {method: 'GET'}).then(function (res) {
    if (res.status !== 200) {
      pidElement.innerText = 'Error: ' + res.status
      return console.log('/terminals POST status: ' + res.status)
    }

    charWidth = Math.ceil(term.element.offsetWidth / cols)
    charHeight = Math.ceil(term.element.offsetHeight / rows)

    res.text().then(function (pid) {
      window.pid = pid
      socketURL += pid
      socket = new WebSocket(socketURL)
      pidElement.innerText = 'Pid: ' + pid
      wsElement.innerText = 'WS: ' + wsReset
      wsDate = new Date()
      socket.onopen = runRealTerminal
      socket.onclose = resetSocket
      socket.onerror = runFakeTerminal
    })
  })
}

function resetSocket () {
  terminalContainer.className += ' fade-out'
  console.log('---------- websocket reset -----------')
  fetch('/terminals?cols=' + term.cols + '&rows=' + term.rows + '&processID=' + pid, {method: 'GET'}).then(function (res) {

    if (res.status !== 200) {
      pidElement.innerText = 'Error: ' + res.status
      return console.log('/terminals POST status: ' + res.status)
    }
    res.text().then(function (pid) {
      if (pid !== window.pid) {
        window.pid = pid
        term.writeln('--------- new pid: ' + pid + ' ---------')
      }
      socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/terminals/' + pid
      socket = new WebSocket(socketURL)
      terminalContainer.className = terminalContainer.className.replace(/\bfade-out\b/, '')

      wsReset += 1
      var oldWsDate = wsDate
      wsDate = new Date()
      wsElement.innerText = 'WS: ' + wsReset + ' (' + (wsDate - oldWsDate) / 1000 + 's)'

      pidElement.innerText = 'Pid: ' + pid
      socket.onopen = runRealTerminal
      socket.onclose = resetSocket
      socket.onerror = runFakeTerminal
    })
  })
}

function runRealTerminal () {
  term.attach(socket)
  term._initialized = true
}

function runFakeTerminal () {
  if (term._initialized) {
    return
  }

  term._initialized = true

  var shellprompt = '$ '

  term.prompt = function () {
    term.write('\r\n' + shellprompt)
  }

  term.writeln('Welcome to xterm.js')
  term.writeln('This is a local terminal emulation, without a real terminal in the back-end.')
  term.writeln('Type some keys and commands to play around.')
  term.writeln('')
  term.prompt()

  term.on('key', function (key, ev) {
    var printable = (
      !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey
    )

    if (ev.keyCode === 13) {
      term.prompt()
    } else if (ev.keyCode === 8) {
      // Do not delete the prompt
      if (term.x > 2) {
        term.write('\b \b')
      }
    } else if (printable) {
      term.write(key)
    }
  })

  term.on('paste', function (data, ev) {
    term.write(data)
  })
}
