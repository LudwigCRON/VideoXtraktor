'use strict'
const remote = require('electron').remote
const path = require('path') // Module to manipulate file/directory path
const appRootDir = require('app-root-dir').get()
const spawn = require('child_process').spawn // Module to execute command line
const os = require('os') // Module to detect on which platform we are
var fs = require('fs') // Module to read and write files
fs.isDir = (dpath) => {
  try {
    return fs.lstatSync(dpath).isDirectory()
  } catch (e) {
    return false
  }
}
fs.mkdirp = (dirname) => {
  dirname = path.normalize(dirname).split(path.sep)
  dirname.forEach((sdir, index) => {
    var pathInQuestion = dirname.slice(0, index + 1).join(path.sep)
    if ((!fs.isDir(pathInQuestion)) && pathInQuestion) fs.mkdirSync(pathInQuestion)
  })
}
// For Debug purpose set WINE to true else for production WINE = false
const WINE = true

// define the PATH to ffmpeg
var FFMPEGPATH = 'ffmpeg' // by default assume in the path
if (os.platform() === 'win32') { // WINDOWS
  FFMPEGPATH = path.join(appRootDir, '/node_modules/ffmpeg/ffmpeg.exe')
} else if (os.platform() === 'darwin') { // MAC
  FFMPEGPATH = path.join(appRootDir, '/node_modules/ffmpeg/ffmpeg')
} else { // LINUX
  FFMPEGPATH = path.join(appRootDir, '/node_modules/ffmpeg/ffmpeg.a')
}

FFMPEGPATH = path.normalize(FFMPEGPATH).replace(/\\/g, '/')
process.stdout.write(FFMPEGPATH + '\n')

// listen a change on attributes on the target element to change the view
var router = (function (fs, path) {
  var config = {attributes: true, childList: false, characterData: true}
  var observer = null
  var target = null
  var __load = (view) => {
    if (target != null) {
      fs.readFile(path.join(__dirname, 'windows/', view + '.html'), (err, data) => {
        if (err) throw err
        target.innerHTML = data
        // rebind the close button
        /* document.querySelector('.close-btn').addEventListener('click', (e) => {
          var window = remote.getCurrentWindow()
          window.close()
        }) */
        // then load the appropriate code
        fs.readFile(path.join(__dirname, 'windows/', view + '.js'), (err, data) => {
          if (err) throw err
          var sc = document.createElement('script')
          var code = document.createTextNode(data)
          sc.appendChild(code)
          target.appendChild(sc)
        })
      })
    }
  }
  return {
    'listen': (targetElement) => {
      target = targetElement
      if (observer !== null) observer.disconnect()
      observer = new MutationObserver((mutation) => {
        var view = null
        for (let i = 0; i < mutation[0].target.attributes.length; i++) {
          if (mutation[0].target.attributes[i].nodeName === mutation[0].attributeName) {
            view = mutation[0].target.attributes[i].textContent
            __load(view)
          }
        }
      })
      observer.observe(targetElement, config)
    },
    'stop': () => {
      if (observer !== null) observer.disconnect()
    }
  }
})(fs, path)

var app = (function (spawn, path) {
  var context = null
  var outputFolder = ''
  var stdout = {}

  function __toFormattedTime (t) {
    let ms = parseInt(t * 1000, 10) % 1000
    let s = parseInt(t - ms / 1000, 10) % 60
    let mn = (t > 60) ? parseInt(t - s - ms / 1000, 10) / 60 % 60 : 0
    let hr = (t > 3600) ? parseInt(t - mn * 60 - s - ms / 1000, 10) / 3600 % 24 : 0
    return ('0' + hr).slice(-2) + ':' + ('0' + mn).slice(-2) + ':' + ('0' + s).slice(-2) + '.' + ('00' + ms).slice(-3)
  }

  function __writeStdOut (i, data) {
    stdout[i] += data.toString()
  }

  return {
    'init': (target) => {
      context = target
      context.setAttribute('data-src', 'dashboard.main')
    },
    'open': (view) => {
      context.setAttribute('data-src', view)
    },
    'toFormattedTime': (seconds) => {
      return __toFormattedTime(seconds)
    },
    'toSeconds': (formattedTime) => {
      let arr = formattedTime.split(':')
      let ans = parseInt(arr[0], 10) * 3600 +
                parseInt(arr[1], 10) * 60 +
                parseFloat(arr[2])
      return ans
    },
    'getMetaData': (filePath, callback, code, error) => {
      if (outputFolder === '') {
        outputFolder = path.join(path.dirname(filePath), '/out')
      }
      var fp = '' + path.normalize(filePath).replace(/\\/g, '/') + ''
      process.stdout.write(fp + '\n')
      var ffMET = null
      if ((os.platform() === 'win32') && WINE) {
        ffMET = spawn('wine', [FFMPEGPATH, '-i', fp, '-f', 'ffmetadata', '-'])
        process.stdout.write('wine' + ' ' + [FFMPEGPATH, '-i', fp, '-f', 'ffmetadata', '-'].join(' '))
      } else {
        ffMET = spawn(FFMPEGPATH, ['-i', fp, '-f', 'ffmetadata', '-'])
        process.stdout.write(FFMPEGPATH + ' ' + ['-i', fp, '-f', 'ffmetadata', '-'].join(' '))
      }
      // keep it active
      ffMET.stdin.resume()
      // ffMET.stdout.on('data', callback)
      ffMET.stderr.on('data', (data) => {
        callback(data.toString('utf-8'))
      })
      ffMET.on('close', code)
      ffMET.on('error', error)
    },
    'setOutputFolder': (dirpath) => {
      outputFolder = dirpath
    },
    'extract': (chapter, callback) => {
      let timestamp = new Date().getUTCMilliseconds()
      stdout[timestamp] = ''
      // Create dir recursively if it does not exist!
      fs.mkdirp(outputFolder)
      // Extract videos
      // using a mp4 format H264 video codec without sound in a medium quality
      // and don't ask the user the permission to overwrite
      var ffEXT = null
      if ((os.platform() === 'win32') && WINE) {
        ffEXT = spawn('wine', [FFMPEGPATH, '-i', '' + chapter.origin + '', '-c:v', 'libx264', '-crf', '18', '-an', '-ss', chapter.start, '-to', chapter.end, '-f', 'mp4', path.join(outputFolder, chapter.title.replace(':', ' ').replace('§', 'Para')) + '.mp4', '-y'])
      } else {
        ffEXT = spawn(FFMPEGPATH, ['-i', '' + chapter.origin + '', '-c:v', 'libx264', '-crf', '18', '-an', '-ss', chapter.start, '-to', chapter.end, '-f', 'mp4', path.join(outputFolder, chapter.title.replace(':', ' ').replace('§', 'Para')) + '.mp4', '-y'])
      }
      ffEXT.stdin.resume()
      ffEXT.stderr.on('data', (data) => {
        __writeStdOut(timestamp, data)
      })
      ffEXT.on('close', (code) => {
        let tmp = stdout[timestamp]
        stdout[timestamp] = ''
        callback(code, tmp)
      })
      // ffEXT.on('error', error)
    },
    'concatenate': (group, callback) => {
      // for each element look if exists
      let ready = false
      let i = 0
      let conversion = false
      let hasError = false
      while (i < group.length && !ready) {
        let chapter = group.items[i]
        if (!conversion) {
          ready = fs.existsSync(path.join(outputFolder, chapter.title.replace(':', ' ').replace('§', 'Para')) + '.mp4')
          process.stdout.write(path.join(outputFolder, chapter.title.replace(':', ' ').replace('§', 'Para') + '.mp4') + ready ? ' true\n' : ' false\n')
          if (ready) i++
          else {
            conversion = true
            app.extract(chapter, () => {
              ready = fs.existsSync(path.join(outputFolder, chapter.title.replace(':', ' ').replace('§', 'Para')) + '.mp4')
              conversion = false
              if (!ready) {
                hasError = true
                ready = true // skip and warn of error
              }
              i++
            })
          }
        }
      }
      process.stdout.write(hasError ? ' Not Ready\n' : ' All Ready\n')
      if (ready && !hasError) {
        let timestamp = new Date().getUTCMilliseconds()
        stdout[timestamp] = ''
        let tmpPath = path.join(outputFolder, group.title.replace(':', ' ').replace('§', 'Para') + '.tmp')
        process.stdout.write('creation of ' + tmpPath + '\n')
        // if all ready generate temp concat file
        let wstream = fs.createWriteStream(tmpPath, {
          flags: 'w',
          defaultEncoding: 'utf8',
          fd: null,
          mode: 0o666,
          autoClose: true
        })
        for (let i = 0; i < group.length; i++) {
          wstream.write('file \'' + path.join(outputFolder, group.items[i].title.replace(':', ' ').replace('§', 'Para') + '.mp4') + '\'\n')
        }
        wstream.end()
        // ffmpeg concat
        let output = path.join(outputFolder, group.title.replace(':', ' ').replace('§', 'Para') + '.mp4')
        console.log(output)
        var ffEXT = null
        if ((os.platform() === 'win32') && WINE) {
          ffEXT = spawn('wine', [FFMPEGPATH, '-f', 'concat', '-i', tmpPath, '-c', 'copy', output, '-y'])
        } else {
          ffEXT = spawn(FFMPEGPATH, ['-f', 'concat', '-i', tmpPath, '-c', 'copy', output, '-y'])
        }
        ffEXT.stdin.resume()
        ffEXT.stderr.on('data', (data) => {
          __writeStdOut(timestamp, data)
        })
        ffEXT.on('close', (code) => {
          let tmp = stdout[timestamp]
          stdout[timestamp] = ''
          fs.unlinkSync(tmpPath)
          callback(code, tmp)
        })
        ffEXT.on('error', (err) => {
          fs.unlinkSync(tmpPath)
        })
      }
    }
  }
})(spawn, path)

function createItem (chapter, callback) {
  var itemElt = document.createElement('li')
  itemElt.className = 'chapter'
  var spanElt = document.createElement('span')
  spanElt.className = 'chapter__title'
  spanElt.textContent = chapter.title
  spanElt.contentEditable = true
  itemElt.appendChild(spanElt)
  spanElt = document.createElement('input')
  spanElt.type = 'text'
  spanElt.className = 'chapter__start'
  spanElt.value = app.toFormattedTime(chapter.start)
  VMasker(spanElt).maskPattern('99:99:99.999')
  //spanElt.contentEditable = true
  spanElt.addEventListener('keydown', callback, false)
  spanElt.addEventListener('input', updateDuration, false)
  itemElt.appendChild(spanElt)
  spanElt = document.createElement('input')
  spanElt.type = 'text'
  spanElt.className = 'chapter__end'
  spanElt.value = app.toFormattedTime(chapter.end)
  VMasker(spanElt).maskPattern('99:99:99.999')
  //spanElt.contentEditable = true
  spanElt.addEventListener('keydown', callback, false)
  spanElt.addEventListener('input', updateDuration, false)
  itemElt.appendChild(spanElt)
  spanElt = document.createElement('span')
  spanElt.className = 'chapter__duration'
  spanElt.textContent = app.toFormattedTime(chapter.end - chapter.start)
  spanElt.contentEditable = false
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

function updateDuration (event, args) {
  let chapter = event.target.parentNode
  // get entered value
  let start = app.toSeconds(chapter.querySelector('.chapter__start').value)
  let end = app.toSeconds(chapter.querySelector('.chapter__end').value)
  // update the duration
  chapter.querySelector('.chapter__duration').textContent = app.toFormattedTime(end - start)
}

  // initialization
document.onreadystatechange = () => {
  if (document.readyState === 'complete') {
    // listen to view change
    var target = document.querySelector('#page_load')
    router.listen(target)
    // init the app
    app.init(target)
  }
}
