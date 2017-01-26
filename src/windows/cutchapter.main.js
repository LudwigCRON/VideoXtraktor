'use strict'
var dialogs = require('dialogs')
var electron = require('electron').remote
var button = document.querySelectorAll('.panel--config > button')
var mapLimit = require('async').mapLimit
var mask = require('./js/mask.js')

var treeView = null
/*
 * functionnalities
 */
var CutChapter = (function (app) {
  var chapters = []
  var results = ''
  var regChapter = /Chapter\s#[0-9]+:[0-9]+:\sstart\s([0-9]+.[0-9]+),\send\s([0-9]+.[0-9]+)\n.*\n.*:\s(.*)/gm

  return {
    'get_chapters': (path, callback) => {
      results = ''
      app.getMetaData(path, (data) => { // GET LIVE DATA
        results += data
      }, (code) => { // FFMPEG END
        // get bitrate
        // bitrate:\s([0-9]+.?[0-9]*)\s(.*)
        // parse the metadata to get chapters
        var match = regChapter.exec(results)
        while (match !== null) {
          var chapter = {'start': 0, 'end': 0, 'title': ''}
          chapter.start = parseFloat(match[1])
          chapter.end = parseFloat(match[2]) - 1 // new file always has 1 second extra due to animation
          chapter.title = match[3]
          chapter.origin = path
          chapters.push(chapter)
          match = regChapter.exec(results)
        }
        // only unique chapter
        chapters = chapters.filter((obj, index, self) => {
          return self.findIndex((c) => {
            return c.title === obj.title && c.start === obj.start
          }) === index
        })
        callback(chapters)
      }, (err) => {
      })
    },
    'reset': (chapters0) => {
      chapters = []
      if (typeof chapters0 !== 'undefined') chapters = chapters0
    },
    'getInfo': () => {
      process.stdout.write('extract information ...')
      // add the default header to the table
      document.querySelector('.panel--main > .table').innerHTML = '<!-- header -->' +
      '<li class="table__header">' +
      '<span class="chapter__title">Title</span>' +
      '<span class="chapter__start">Start</span>' +
      '<span class="chapter__end">End</span>' +
      '<span class="chapter__duration">Duration</span>' +
      '</li>'
      // select the movie file
      electron.dialog.showOpenDialog(electron.getCurrentWindow(), {
        title: 'source movie',
        filters: [
          {name: 'Movies', extensions: ['mkv', 'avi', 'mp4', 'm4v']},
          {name: 'All Files', extensions: ['*']}
        ],
        properties: ['openFile']
      }, (filePath) => {
        process.stdout.write(filePath[0])
        // reset the tree view
        CutChapter.reset()
        // parse data from the movie and add them to the view
        CutChapter.get_chapters(filePath[0], (chapters) => {
          // update the view
          treeView = new TreeView(document.querySelector('.panel--main > .table'), {
            dragStartCallback: (event, node) => {
              event.dataTransfer.setData('text/plain', node.textContent)
              return true
            },
            dropCallback: (event, dropLocation, orderedNodes) => {
              return true
            },
            multipleSelection: true
          })
          for (let chapter of chapters) {
            let element = createItem(chapter)
            treeView.append(element, 'item')
          }
        })
      })
    },
    'setOutputFolder': () => {
      electron.dialog.showOpenDialog(electron.getCurrentWindow(), {
        title: 'Output direcotry',
        properties: ['openDirectory', 'createDirectory']
      }, (dirPath) => {
        if (dirPath.length > 0) app.setOutputFolder(dirPath[0])
      })
    }
  }
})(app)

/*
 * event trigger for a stylish input file form
 */
button[0].addEventListener('click', (e) => {
  CutChapter.getInfo()
  document.querySelector('.panel--main').focus()
}, false)

button[1].addEventListener('click', (e) => {
  CutChapter.setOutputFolder()
  document.querySelector('.panel--main').focus()
}, false)

// deselect the row in the table
document.querySelector('.panel--main').addEventListener('click', (e) => {
  // delselect rows
  if (e.target.className.indexOf('panel--main') > -1) treeView.clearSelection()
  // disable the contentEditable
  /* var elem = treeView.treeRoot.querySelectorAll('*[contenteditable]')
  for (let i = 0; i < elem.length; i++) {
    elem[i].setAttribute('contenteditable', false)
  }*/
}, false)

// create an item or a group if an item is selected
document.querySelector('#add-group-btn').addEventListener('click', (event) => {
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
}, false)

// delete an item
document.querySelector('#remove-btn').addEventListener('click', (e) => {
  // remove those selected even without check
  while (treeView.selectedNodes.length > 0) {
    treeView.remove(treeView.selectedNodes[treeView.selectedNodes.length - 1])
  }
  // remove checked items
  let elementsToRemove = [... document.querySelectorAll('.chapter__select:checked')].map((el, i) => {return el.parentNode})
  for(let i=0; i<elementsToRemove.length; i++) treeView.remove(elementsToRemove[i])
}, false)

// clone items
document.querySelector('#clone-btn').addEventListener('click', (e) => {
  for (let i = 0; i < treeView.selectedNodes.length; i++) {
    if (treeView.selectedNodes[i].className.indexOf('item') > 0) treeView.append(treeView.selectedNodes[i].cloneNode(true), 'item', null)
  }
  treeView.clearSelection()
}, false)

// launch the extraction
document.querySelector('#exec-btn').addEventListener('click', (e) => {
  // get number of process
  let pNb = parseInt(document.querySelector('[name="processNb"]').value, 10)
  // get chapters updated
  let chapters = treeView.treeRoot.querySelectorAll('.chapter')
  let tasks = []
  for (let i = 0; i < chapters.length; i++) {
    tasks.push({
      'title': chapters[i].querySelector('.chapter__title').textContent,
      'start': chapters[i].querySelector('.chapter__start').value,
      'end': chapters[i].querySelector('.chapter__end').value,
      'origin': chapters[i].querySelector('.chapter__origin').textContent
    })
  }
  // extract first the chapters
  mapLimit(tasks, pNb, app.extract, (err, results) => {
    if (err !== null) process.stdout.write(err)
    process.stdout.write(results.toString())
    // then group them
    let groupsDOM = treeView.treeRoot.querySelectorAll('.group')
    var groups = []
    for (let i = 0; i < groupsDOM.length; i++) {
      let chapters = groupsDOM[i].nextSibling.querySelectorAll('.chapter')
      var g = {'title': '', 'length': '', 'items': []}
      g.title = groupsDOM[i].querySelector('.group__title').textContent
      g.length = chapters.length
      for (let j = 0; j < chapters.length; j++) {
        g.items.push({
          'title': chapters[j].querySelector('.chapter__title').textContent,
          'start': chapters[j].querySelector('.chapter__start').value,
          'end': chapters[j].querySelector('.chapter__end').value,
          'origin': chapters[j].querySelector('.chapter__origin').textContent
        })
      }
      groups.push(g)
    }
    mapLimit(groups, pNb, app.concatenate, (err, results) => {
      if (err !== null) process.stdout.write(err.toString())
      process.stdout.write(results.toString())
    })
  })
}, false)

/*
 * handle split view
 */
var handle = document.querySelector('.handle')
var panel_config = document.querySelector('.panel--config')
var handle_drag = false
var handle_pos = {'x': 0, 'y': 0}
var cursor = document.querySelector('.cursor')

handle.addEventListener('mousedown', (e) => {
  handle_drag = true
  handle_pos.x = e.clientX - parseInt(handle.getClientRects()[0].left, 10)
  handle_pos.y = e.clientY - parseInt(handle.getClientRects()[0].top, 10)
  if (handle_pos.dir === 'h') {
      panel_config.style.width = parseInt(handle.getClientRects()[0].left, 10)+ 'px'
    } else if (handle_pos.dir === 'v') {
      panel_config.style.height = parseInt(handle.getClientRects()[0].top, 10) + 'px'
    }
}, false)

document.addEventListener('mouseup', (e) => {
  handle_drag = false
}, false)

document.addEventListener('mousemove', (e) => {
  if (handle_drag) {
    panel_config.style.width = e.clientX + 'px'
  }
}, false)