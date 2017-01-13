var electron = require('electron').remote
var button = document.querySelectorAll('.panel--config > button')
var player = document.querySelector('.preview-player')
var main = document.querySelector('.panel--main')
var table = document.querySelector('.panel--main .table')

var treeView = null

var shortCut = {'SPACEBAR': 32, 'SEEK': 83}
var newSubtitle = false
var tmpChapter = {'text':'', 'start':0, 'end':0}

var SubTitler = (function() {
  var subtitles = []

  return {
    'selectTheMovie': () => {
      // select the movie file
      electron.dialog.showOpenDialog(electron.getCurrentWindow(), {
        title: 'source movie',
        filters: [
          {name: 'Movies', extensions: ['mkv', 'avi', 'mp4', 'm4v']},
          {name: 'All Files', extensions: ['*']}
        ],
        properties: ['openFile']
      }, (filePath) => {
        player.src = filePath
      })
    },
    'addSubtitle': (text, start, end) => {
      subtitles.push({
        'text': text,
        'start': start,
        'end': end
      })
    }
  }
})();

/*
 * event trigger for a stylish input file form
 */
button[0].addEventListener('click', (e) => {
  // add the default header to the table
  table.innerHTML = '<!-- header -->' +
  '<li class="table__header">' +
  '<span class="chapter__title">Title</span>' +
  '<span class="chapter__start">Start</span>' +
  '<span class="chapter__end">End</span>' +
  '<span class="chapter__duration">Duration</span>' +
  '</li>' 
  // select the movie file
  SubTitler.selectTheMovie()
  treeView = new TreeView(table, {
    dragStartCallback: (event, node) => {
      event.dataTransfer.setData('text/plain', node.textContent)
      return true
    },
    dropCallback: (event, dropLocation, orderedNodes) => {
      return true
    },
    multipleSelection: true
  })
}, false)

document.addEventListener('keypress', (e) => {
  if (e.keyCode === shortCut.SPACEBAR) {
    newSubtitle = !newSubtitle
    if (newSubtitle) {
      tmpChapter.start = player.currentTime
    } else {
      tmpChapter.end = player.currentTime
      treeView.append(
        createItem(tmpChapter, (e) => {
          if (e.ctrlKey && e.keyCode === shortCut.SEEK)
          player.currentTime = app.toSeconds(e.target.value)
        }),
        'item'
      )
    }
  }
}, false)

/*
 * handle split view
 */
var handle = document.querySelector('.handle')
var container = document.querySelector('.container_16_9')
var handle_drag = false
var handle_pos = {'x': 0, 'y': 0}
var cursor = document.querySelector('.cursor')

handle.addEventListener('mousedown', (e) => {
  handle_drag = true
  handle_pos.x = e.clientX - parseInt(handle.getClientRects()[0].left, 10)
  handle_pos.y = e.clientY - parseInt(handle.getClientRects()[0].top, 10)
  container.style.height = parseInt(container.getClientRects()[0].top, 10) + 'px'
}, false)

document.addEventListener('mouseup', (e) => {
  handle_drag = false
}, false)

document.addEventListener('mousemove', (e) => {
  if (handle_drag) {
    container.style.height = e.clientY - handle_pos.y + 'px'
    player.style.height = e.clientY - handle_pos.y - 10 + 'px'
    table.style.height = main.getClientRects()[0].height - container.getClientRects()[0].height + 'px'
  }
}, false)