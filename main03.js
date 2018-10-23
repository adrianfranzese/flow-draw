let toggleBlob = document.getElementById('toggleBlob')
let toggleFace = document.getElementById('toggleFace')

let video = document.getElementById("cam") // load video element
let c = document.getElementById('vidCapture')
let cx = c.getContext('2d')

// TODO: parametize these
let squiggle = 0.25 // 0.25 to 0.9
let cannyMin = 100
let cannyMax = 175
let simplifyFactor = 2 // 2 to 30?

let colourSchemes = [
  ['#f46572', '#f58c93', '#eaedf4', '#efcc57', '#f05152'],
  ['#ff6138', '#ffff9d', '#beeb9f', '#79bd8f', '#00a388'],
  ['#74d3ae', '#678d58', '#a6c48a', '#f6e7cb', '#dd9787'],
  ['#1c7c54', '#73e2a7', '#a6c48a', '#def4c6', '#1b512d'],
  ['#ffe74c', '#ff5964', '#f5f5f5', '#6bf178', '#35a7ff'],
  ['#ff4e50', '#fc913a', '#f9d423', '#ede574', '#e1f5c4'],
  ['#52489c', '#4062bb', '#59c3c3', '#ebebeb', '#f45b69'],
  ['#ea8c55', '#c75146', '#ad2e24', '#81171b', '#540804'],
  ['#2b2d42', '#8d99ae', '#ad2e24', '#edf2f4', '#ef233c'],
  ['#ffcad4', '#b0d0d3', '#c08497', '#f7af9d', '#f4e1de'],
  ['#3d315b', '#444b6e', '#708b75', '#9ab87a', '#f8f991']
]

let colourScheme
window.onload = function() {
  paper.setup('drawing')
  calcDimensions()
  let noTool = new paper.Tool()
  let pencil = new paper.Tool()
  let airbrush = new paper.Tool()

  // FIXME: tidy up how layers are mananged
  let blobLayer = new paper.Layer()
  let personLayer = new paper.Layer()
  let drawLayer = new paper.Layer()

  function setVideoDimensions() {
    // video.width = 140
    // video.height = 100
    //
    // c.width = video.width
    // c.height = video.height
    video.width = video.videoWidth / 4
    video.height = video.videoHeight / 4

    c.width = video.width
    c.height = video.height
  }

  // Declare OpenCV mats
  let source
  let contours
  let hierarchy
  let hull

  function initMats() {
    // initialise mats on run
    source = new cv.Mat(video.videoHeight / 4, video.videoWidth / 4, cv.CV_8UC4)
    contours = new cv.MatVector()
    hierarchy = new cv.Mat()
    hull = new cv.MatVector();
  }

  function clearMats() {
    // clear mats when finished with them this cycle
    source.delete();
    contours.delete();
    hierarchy.delete();
    hull.delete();
  }

  let videoConstraints = {
    audio: false,
    video: {
      facingMode: "user"
    },
  }

  // initialise webcam
  navigator.mediaDevices.getUserMedia(videoConstraints)
    .then(stream => {
      // setVideoDimensions()
      video.addEventListener('loadedmetadata', setVideoDimensions, false)

      video.srcObject = stream
      video.play()
      processVideo()
    })
    .catch(e => console.error(e))

  function processVideo() {
    initMats()

    cx.drawImage(video, 0, 0, video.width, video.height)
    source = cv.imread(c)
    // source = removeBackground(source)
    source = drawEdges(source, cannyMin, cannyMax)
    cv.imshow(c, source)

    cv.findContours(source, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    // delete previous paths
    blobLayer.removeChildren()
    personLayer.removeChildren()

    colourScheme = randomIndex(colourSchemes)

    // console.log(contours.size());
    for (let i = 0; i < contours.size(); i++) {
      let contour = contours.get(i)
      let area = cv.contourArea(contour, false);
      if (area > 0) {
        if (toggleBlob.checked) { drawHull(contour) }
        if (toggleFace.checked) { drawAContour(contour) }
      }
    }
    blobLayer.scale(4)
    blobLayer.position = paper.view.center;
    personLayer.scale(4)
    personLayer.position = paper.view.center;

    clearMats()
    // Only load next frame every 3 seconds
    setTimeout(function() {
      requestAnimationFrame(processVideo)
    }, 3000)
  // }, 1500)
  }

  // cv.cvtColor(source, source, cv.COLOR_RGBA2GRAY, 0)
  // cv.threshold(source, source, 50, 80, cv.THRESH_BINARY_INV)

  function removeBackground(_input) {
    // cv.cvtColor(_input, _input, cv.COLOR_RGBA2GRAY);
    // let mask = new cv.Mat();
    // let bgdModel = new cv.Mat();
    // let fgdModel = new cv.Mat();
    // let rect = new cv.Rect(video.width/2 - 50, video.height/2 + 50, video.width/2 + 50, video.width/2 +50);
    // cv.grabCut(_input, mask, rect, bgdModel, fgdModel, 1, cv.GC_INIT_WITH_RECT);
    //
    // for (let i = 0; i < _input.rows; i++) {
    //   for (let j = 0; j < _input.cols; j++) {
    //       if (mask.ucharPtr(i, j)[0] == 0 || mask.ucharPtr(i, j)[0] == 2) {
    //           _input.ucharPtr(i, j)[0] = 0;
    //           _input.ucharPtr(i, j)[1] = 0;
    //           // _input.ucharPtr(i, j)[2] = 0;
    //       }
    //   }
    // }

    let fgmask = new cv.Mat(video.height, video.width, cv.CV_8UC1);
    let fgbg = new cv.BackgroundSubtractorMOG2(500, 16, true);

    return source;
  }

  function drawEdges(_input, _minVal, _maxVal) {
    cannyOutput = new cv.Mat();
    cv.cvtColor(_input, _input, cv.COLOR_RGBA2GRAY);
    // cv.equalizeHist(_input, _input);
    cv.Canny(_input, cannyOutput, _minVal, _maxVal, 3, false);
    return cannyOutput;
  }

  function drawPoints(thisContour, thisPath) {
    // https://stackoverflow.com/questions/43108751/convert-contour-paths-to-svg-paths
    for (let c = 0; c < thisContour.length; c += 2) {
      // [x1][y1],[x2][y2]....
      //  c  +1 ,  c  +1 ....
      thisPath.add(new paper.Point({
        x: thisContour[c],
        y: thisContour[c + 1]
      }))
    }
  }

  // QUESTION: should this use threshold instead of canny?
  function drawHull(thisContour) {
    blobLayer.activate()

    let thisHull = new cv.Mat();
    cv.convexHull(thisContour, thisHull, false, true);
    thisHull = thisHull.data32S

    let fill = new paper.Path({
      fillColor: randomIndex(colourScheme),
      blendMode: 'multiply'
    })
    drawPoints(thisHull, fill)
    fill.closePath()
    // fill.reduce()
    // OPTIMIZE: Call once when all are done?
    fill.simplify()
    // TODO which smoothing type to use?
    fill.smooth({
      // type: 'continuous'
      type: 'catmull-rom',
      factor: 1.0
    })
    // hull.push_back(tmp);
  }


  function drawAContour(thisContour) {
    let area = cv.contourArea(thisContour, false)
    thisContour = thisContour.data32S
    personLayer.activate()
    let path = new paper.Path({
      strokeColor: 'midnightblue',
      selected: false,
      strokeCap: 'round',
      strokeJoin: 'round',
      strokeScaling: false,
    })

    drawPoints(thisContour, path)

    path.reduce()
    // OPTIMIZE: Call once when all are done?
    path.simplify(simplifyFactor)
    // TODO which smoothing type to use?
    path.smooth({
      type: 'geometric',
      factor: squiggle
    })

    // BADIDEA: asign weight based on contour properties?
    path.strokeWidth = 0.5 + Math.random() * 2
    path.dashArray = [path.length + 50]
    path.dashOffset = path.length + 50
    // path.strokeWidth = constrain(area*0.01, 0.5, 2)

    path.onFrame = function (frame) {
      // this.dashOffset = path.index + frame.count
      // if (this.dashOffset != this.length) {
      //   this.dashOffset = frame.count
      // } else {
      //   this.dashOffset = 0
      // }
    }
  }

  // Switch current drawing tool
  let mouseTools = document.getElementsByName('mouseTool')
  mouseTools.forEach(mouseTool => {
    mouseTool.addEventListener('click', () => {
      switch (mouseTool.value) {
        case 'noTool':
          noTool.activate()
          paper.view.element.style.cursor = `auto`
          console.log('no tool');
          break;
        case 'pencil':
          pencil.activate()
          paper.view.element.style.cursor = `url('icons/pencilUp.png'), pointer`
          console.log('pencil tool');
          break;
        case 'airbrush':
          airbrush.activate()
          paper.view.element.style.cursor = `url('icons/airbrush.png'), pointer`
          console.log('airbrush tool');
          break;
      }
    })
  })

  let pencilPath
  pencil.minDistance = 10
  pencil.onMouseDown = function(click) {
    drawLayer.activate()
    pencilPath = new paper.Path()
    pencilPath.style = {
      strokeColor: 'midnightblue',
      strokeWidth: 0.25,
      opacity: 0.25
    }
  }

  pencil.onMouseDrag = function(click) {
    drawLayer.activate()
    pencilPath.add(click.point);
    // let buffer = Math.ceil(paper.project.layers[1].children.length / 10)
    let total = pencilPath.segments.length
    let prev = pencilPath.segments[total - 5]
    // let prev = pencilPath.segments[total - buffer]

    if (prev) {
      let line = new paper.Path.Line(prev.point, click.point)
      line.style = pencilPath.style
      line.opacity = Math.random()
    }
  }

  let airbrushPath
  let airbrushColour
  airbrush.minDistance = 10

  airbrush.onMouseDown = function (click) {
    airbrushColour = randomIndex(colourScheme)
  }
  airbrush.onMouseDrag = function (click) {
    drawLayer.activate()
    airbrushPath = new paper.Path.Circle(click.point, click.delta.length)
    airbrushPath.style = {
      fillColor: new paper.Color(1, 1, 1, 0.1),
      shadowColor: airbrushColour,
      shadowBlur: 40,
      // blendMode: 'color-burn'
    }

    // airbrushPath.onFrame = function (frame) {
    //   // this.position.x += 0.5*Math.cos(frame.time + 0);
    //   // this.position.y += 0.5*Math.sin(frame.time + 0.1);
    //   // this.opacity += 0.5*Math.cos(frame.time + 0)
    //   // this.scale(click.delta.length + 0.5*Math.cos(frame.time + 0))
    // }
  }
}

function calcDimensions() {
  let toolboxHeight = document.getElementById('toolbox').clientHeight
  let minHeight = document.documentElement.clientHeight - 40 - toolboxHeight
  paper.view.viewSize.height = minHeight
  paper.view.viewSize.width = minHeight
}

function saveCanvas() {
  let url = `data:image/svg+xml;utf8,${encodeURIComponent(paper.project.exportSVG({asString:true}))}`;
  let datetime = new Date()
  let dw = document.createElement("a");
  dw.download = `portrait ${datetime.toLocaleTimeString()}.svg`;
  dw.href = url;
  dw.target = `_blank`
  document.body.appendChild(dw);
  dw.click();
  document.body.removeChild(dw)
}

function clearDrawing() {
  paper.project.layers[2].clear()
}

function map(n, in_min, in_max, out_min, out_max) {
  return (n - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function randomBetween(min, max) {
  return (Math.random() * (max - min + 1)) + min
  //The maximum is inclusive and the minimum is inclusive
}

function constrain(n, low, high) {
  return Math.max(Math.min(n, high), low);
};


// from https://css-tricks.com/snippets/javascript/select-random-item-array/
function randomIndex(thisArray) {
  return thisArray[Math.floor(Math.random() * thisArray.length)]
}
