const log = console.log

function store(state, emitter) {
  const serial = window.BridgeSerial
  const disk = window.BridgeDisk

  state.ports = []
  state.diskFiles = []
  state.serialFiles = []
  state.selectedFile = null
  state.selectedDevice = 'disk'

  state.diskPath = null
  state.serialPath = null

  state.isConnected = false
  state.isPortDialogOpen = false
  state.isTerminalOpen = false
  state.isFilesOpen = false
  state.isEditingFilename = false
  state.isTerminalBound = false

  // SERIAL CONNECTION
  emitter.on('load-ports', async () => {
    log('load-ports')
    state.ports = await serial.loadPorts()
    emitter.emit('render')
  })
  emitter.on('open-port-dialog', async () => {
    log('open-port-dialog')
    emitter.emit('disconnect')
    state.ports = await serial.loadPorts()
    state.isPortDialogOpen = true
    emitter.emit('render')
  })
  emitter.on('close-port-dialog', async () => {
    log('close-port-dialog')
    state.isPortDialogOpen = false
    emitter.emit('render')
  })

  emitter.on('disconnect', () => {
    log('disconnect')
    state.serialPath = null
    state.isConnected = false
    state.isTerminalOpen = false
    state.isFilesOpen = false
    emitter.emit('render')
  })
  emitter.on('connect', async (path) => {
    log('connect')
    state.serialPath = path
    await serial.connect(path)
    await serial.stop()
    let term = state.cache(XTerm, 'terminal').term
    if (!state.isTerminalBound) {
      state.isTerminalBound = true
      term.onData((data) => {
        serial.eval(data)
        term.scrollToBottom()
      })
    }
    serial.onData((data) => {
      term.write(data)
      term.scrollToBottom()
    })
    state.isConnected = true
    emitter.emit('update-files')
    emitter.emit('close-port-dialog')
    emitter.emit('show-terminal')
    emitter.emit('render')
  })

  // CODE EXECUTION
  emitter.on('run', async () => {
    log('run')
    if (!state.isTerminalOpen) emitter.emit('show-terminal')
    let editor = state.cache(AceEditor, 'editor').editor
    let code = editor.getValue()
    await serial.run(code)
    emitter.emit('render')
  })
  emitter.on('stop', async () => {
    log('stop')
    await serial.stop()
    emitter.emit('render')
  })
  emitter.on('reset', async () => {
    log('reset')
    await serial.reset()
    emitter.emit('update-files')
    emitter.emit('render')
  })

  // FILE MANAGEMENT
  emitter.on('new-file', () => {
    log('new-file')
    let editor = state.cache(AceEditor, 'editor').editor
    state.selectedFile = 'undefined'
    editor.setValue('')
    emitter.emit('render')
  })
  emitter.on('save', async () => {
    log('save')
    if (state.selectedDevice === 'serial') {
      let editor = state.cache(AceEditor, 'editor').editor
      let contents = editor.getValue()
      let filename = state.selectedFile || 'undefined'
      await serial.saveFileContent(contents, filename)
      emitter.emit('update-files')
    }

    if (state.selectedDevice === 'disk') {
      // TODO
    }
  })
  emitter.on('remove', async () => {
    log('remove')
    if (state.selectedDevice === 'serial') {
      await serial.removeFile(state.selectedFile)
      emitter.emit('update-files')
    }
    if (state.selectedDevice === 'disk') {
      // TODO
    }
    emitter.emit('render')
  })

  emitter.on('select-file', async (device, filename) => {
    log('select-file')
    state.selectedDevice = device
    state.selectedFile = filename

    if (state.selectedDevice === 'serial') {
      let content = await serial.loadFile(filename)
      content = content.replace(//g, ``) // XXX: Remove character that breaks execution
      let editor = state.cache(AceEditor, 'editor').editor
      editor.setValue(content)
    }

    if (state.selectedDevice === 'disk') {
      let content = await disk.loadFile(state.diskPath, filename)
      let editor = state.cache(AceEditor, 'editor').editor
      editor.setValue(content)
    }

    emitter.emit('render')
  })

  emitter.on('open-folder', async () => {
    log('open-folder')
    let { folder, files } = await disk.openFolder()
    state.diskPath = folder
    state.diskFiles = files
    if (!state.isFilesOpen) emitter.emit('show-files')
    emitter.emit('render')
  })
  emitter.on('update-files', async () => {
    log('update-files')
    if (state.isConnected) {
      await serial.stop()
      state.serialFiles = await serial.listFiles()
    }
    if (state.diskPath) {
      state.diskFiles = await disk.listFiles(state.diskPath)
    }
    emitter.emit('render')
  })

  // PANEL MANAGEMENT
  emitter.on('show-terminal', () => {
    log('show-terminal')
    state.isTerminalOpen = !state.isTerminalOpen
    state.isFilesOpen = false
    emitter.emit('render')
  })
  emitter.on('show-files', () => {
    log('show-files')
    state.isTerminalOpen = false
    state.isFilesOpen = !state.isFilesOpen
    emitter.emit('update-files')
    emitter.emit('render')
  })





}
