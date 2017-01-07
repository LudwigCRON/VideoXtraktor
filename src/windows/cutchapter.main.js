'use strict'
var dialogs = require('dialogs')
var electron = require('electron').remote
var button = document.querySelectorAll('.panel--config > button')
var mapLimit = require('async').mapLimit

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
          console.log(chapter)
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
    'getInfo': (e) => {
      process.stdout.write('extract information ...')
      // add the default header to the table
      document.querySelector('.panel--main > .table').innerHTML = '<!-- header -->' +
      '<li class="table__header">' +
      '<span class="chapter__title">Title</span>' +
      '<span class="chapter__start">Start</span>' +
      '<span class="chapter__end">End</span>' +
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
    'setOutputFolder': (fp) => {
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
function createItem (chapter) {
  var itemElt = document.createElement('li')
  itemElt.className = 'chapter'
  var spanElt = document.createElement('span')
  spanElt.className = 'chapter__title'
  spanElt.textContent = chapter.title
  spanElt.contentEditable = true
  itemElt.appendChild(spanElt)
  spanElt = document.createElement('span')
  spanElt.className = 'chapter__start'
  spanElt.textContent = app.toFormattedTime(chapter.start, chapter.framerate)
  spanElt.contentEditable = true
  itemElt.appendChild(spanElt)
  spanElt = document.createElement('span')
  spanElt.className = 'chapter__end'
  spanElt.textContent = app.toFormattedTime(chapter.end, chapter.framerate)
  spanElt.contentEditable = true
  itemElt.appendChild(spanElt)
  spanElt = document.createElement('span')
  spanElt.className = 'chapter__framerate'
  spanElt.textContent = 1 / chapter.framerate
  itemElt.appendChild(spanElt)
  spanElt = document.createElement('span')
  spanElt.className = 'chapter__origin'
  spanElt.textContent = chapter.origin
  itemElt.appendChild(spanElt)
  return itemElt
}

function createGroup (label) {
  var groupElt = document.createElement('li')
  var spanElt = document.createElement('span')
  spanElt.className = 'group__title'
  spanElt.textContent = label
  spanElt.contentEditable = true
  groupElt.appendChild(spanElt)
  return groupElt
}

button[0].addEventListener('click', CutChapter.getInfo, false)
button[1].addEventListener('click', CutChapter.setOutputFolder, false)

// deselect the row in the table
document.querySelector('.panel--main').addEventListener('click', (e) => {
  e.preventDefault()
  e.stopPropagation()
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
  /* electron.dialog.showMessageBox(electron.getCurrentWindow(), {
    type: 'question',
    buttons: ['cancel', 'create'],
    cancelId: 0,
    defaultId: 0,
    title: 'Create a new group',
    message: 'Enter a name:'
  }) */
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
  while (treeView.selectedNodes.length > 0) {
    treeView.remove(treeView.selectedNodes[treeView.selectedNodes.length - 1])
  }
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
      'start': chapters[i].querySelector('.chapter__start').textContent,
      'end': chapters[i].querySelector('.chapter__end').textContent,
      'origin': chapters[i].querySelector('.chapter__origin').textContent
    })
  }
  // extract first the chapters
  mapLimit(tasks, pNb, app.extract, (err, results) => {
    if (err !== null) process.stdout.write(err)
    process.stdout.write(results.toString())
  })
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
        'start': chapters[j].querySelector('.chapter__start').textContent,
        'end': chapters[j].querySelector('.chapter__end').textContent,
        'origin': chapters[j].querySelector('.chapter__origin').textContent
      })
    }
    groups.push(g)
  }
  console.log(groups)
  mapLimit(groups, pNb, app.concatenate, (err, results) => {
    if (err !== null) process.stdout.write(err.toString())
    process.stdout.write(results.toString())
  })
}, false)
