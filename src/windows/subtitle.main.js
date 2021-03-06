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
  var _outputPath = "tmp.vtt"

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
    },
    'setOutputFile': () => {
      electron.dialog.showSaveDialog(electron.getCurrentWindow(), {
        title: 'source movie',
        filters: [
          {name: 'Subtitle Track', extensions: ['srt', 'vtt']},
          {name: 'All Files', extensions: ['*']}
        ],
        properties: ['openFile']
      }, (filePath) => {
        if (filePath.length > 0) _outputPath = filePath[0]
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

button[1].addEventListener('click', (e) => {
  SubTitler.setOutputFile()
  document.querySelector('.panel--main').focus()
}, false)

document.querySelector('#export-btn').addEventListener('click', (e) => {
  
})

document.querySelector('#reload-btn').addEventListener('click', (e) => {

})

document.querySelector('#add-btn').addEventListener('click', (e) => {
  var type = (treeView.selectedNodes.length > 0) ? 'group' : 'item'
  dialogs().prompt('Enter a name', (label) => {
    // console.log(label, type)
    if (label.length === 0) return
    var node = (type === 'item') ? createItem(label) : createGroup(label)
    var parentNode = treeView.selectedNodes[0]
    if (parentNode != null && !parentNode.classList.contains('group')) {
      parentNode = parentNode.parentElement.classList.contains('children') ? parentNode.parentElement.previousSibling : null
    }
    treeView.append(node, type, parentNode)
  })
})

document.querySelector('#remove-btn').addEventListener('click', (e) => {
  // remove those selected even without check
  while (treeView.selectedNodes.length > 0) {
    treeView.remove(treeView.selectedNodes[treeView.selectedNodes.length - 1])
  }
  // remove checked items
  let elementsToRemove = [... document.querySelectorAll('.chapter__select:checked')].map((el, i) => {return el.parentNode})
  for(let i=0; i<elementsToRemove.length; i++) treeView.remove(elementsToRemove[i])
})

document.addEventListener('keypress', (e) => {
  if (e.keyCode === shortCut.SPACEBAR && document.activeElement.className.indexOf('chapter') < 0) {
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