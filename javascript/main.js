import * as THREE from 'three'
import { OrbitControls } from 'three/addons/OrbitControls.js'
import { OBJLoader } from 'three/addons/OBJLoader.js'
import { STLLoader } from 'three/addons/STLLoader.js'

let optimizedModel = null

/*
 * Events
 */
document.getElementById('slider').addEventListener('input', () => {
  update_simplify_to()
})

const mainDiv = document.getElementById('content')

mainDiv.addEventListener('dragenter', (event) => {
  event.stopPropagation()
  event.preventDefault()
})

mainDiv.addEventListener('dragover', (event) => {
  event.stopPropagation()
  event.preventDefault()
})

mainDiv.addEventListener('drop', (event) => {
  event.stopPropagation()
  event.preventDefault()
  dodrop(event)
})

document.getElementById('fileuploadform').addEventListener('change', () => {
  uploaded()
})

document.getElementById('simplify').addEventListener('click', () => {
  uploaded()
})

/*
 * SimpQuadric Mesh Simplification
 * https://myminifactory.github.io/Fast-Quadric-Mesh-Simplification/
 */
var worker = new Worker('./javascript/worker.js')

worker.onmessage = function (e) {
  const log = e.data.log
  if (log !== undefined) {
    var logger = document.getElementById('simplify_log')
    logger.innerHTML += '<li>' + log + '</li>'
    var box = document.getElementById('simplify_box')
    box.scrollTop = box.scrollHeight
    return
  }

  const file = e.data.blob
  if (file !== undefined) {
    const s_name = SIMPLIFY_FILE.simplify_name

    let url = window.URL.createObjectURL(file)
    optimizedModel = url

    var download = document.getElementById('download_a')
    download.href = url
    download.download = s_name

    var download_button = document.getElementById('download')
    //download_button.innerHTML = 'Click to download ' + '<br>' + s_name
    download_button.disabled = false
    download_button.className = 'download_ready_signal'

    // Call Three.js
    loader(1)

    setTimeout(function () {
      download_button.className = ''
    }, 1000)
    put_status('Ready to download')
    return
  }

  console.error('Unknown Message from WebWorker', e.data)
}

worker.onerror = function (e) {
  console.log(e)
  console.log('ERROR: Line ', e.lineno, ' in ', e.filename, ': ', e.message)
}

let SIMPLIFY_FILE = {
  blob: undefined,
  get name() {
    if (this.exists) return this.blob.name
  },
  get simplify_name() {
    if (this.exists) return 'simplify_' + this.name
  },
  get size() {
    if (this.exists) return this.blob.size
  },
  get exists() {
    if (this.blob) return true
    else {
      return false
    }
  },
}

function update_simplify_to() {
  const slider_value = get_value_from_slider()
  if (slider_value >= 10) document.getElementById('percentage').innerHTML = `${slider_value}%`
  else document.getElementById('percentage').innerHTML = `0${slider_value}%`
  if (SIMPLIFY_FILE.exists) {
    document.getElementById('size').innerHTML = `~${Math.ceil(
      (slider_value * SIMPLIFY_FILE.size) / (100 * 1024 * 1024),
    )}MB`
  }
}

function get_value_from_slider() {
  return document.getElementById('slider').valueAsNumber
}

function uploaded(file) {
  let uploadform = document.getElementById('fileuploadform')

  if (file === undefined) {
    // via upload button
    uploadform = document.getElementById('fileuploadform')
    file = uploadform.files[0]

    // this helps to force trigger even if user upload the same file
    // https://stackoverflow.com/a/12102992/5260518
    uploadform.value = null
  }

  if (file === undefined) {
    // not via upload button defined otherwise
    file = SIMPLIFY_FILE.blob
  }

  //uploadform.files[0] = file

  SIMPLIFY_FILE.blob = file
  check_file(post_to_worker)

  // Calling Three.js
  loader(0)
}

function check_file(success_cb) {
  if (SIMPLIFY_FILE.name) {
    put_status('Checking file')
    const filename = SIMPLIFY_FILE.name
    const extension = filename.toLowerCase().slice(filename.lastIndexOf('.') + 1, filename.length)
    if (extension !== 'stl' && extension !== 'obj') {
      put_status('Please upload an stl or obj file not ' + extension)
      return
    }
    success_cb()
  } else {
    put_status('Upload a file first!')
  }
}

function post_to_worker() {
  update_simplify_to()
  put_status('Simplifying by the browser...See the logs')
  worker.postMessage({
    blob: SIMPLIFY_FILE.blob,
    percentage: get_value_from_slider() / 100,
    simplify_name: SIMPLIFY_FILE.simplify_name,
  })
}
function dodrop(event) {
  var dt = event.dataTransfer
  var file = dt.files[0]
  uploaded(file)
}

function put_status(text) {
  document.getElementById('status').textContent = text
}

function simplify() {
  update_simplify_to()
}

window.onload = simplify

/*
 * Three.js
 */
let canvas, renderer, aspectRatio

const scenes = []
const controllers = []

const atmos = new THREE.HemisphereLight(0xaaaaaa, 0x444444, 3)
const light = new THREE.DirectionalLight(0xffffff, 1.5)
light.position.set(1, 1, 1)

const atmos2 = atmos.clone()
const light2 = light.clone()

const material = new THREE.MeshNormalMaterial({
  flatShading: true,
})

const placeholderMat = new THREE.MeshStandardMaterial({
  wireframe: true,
})

function loader(state) {
  const loaders = {
    obj: new OBJLoader(),
    stl: new STLLoader(),
  }

  const loadObj = (file) => {
    loaders.obj.load(file, (obj) => {
      scenes[state].clear()

      obj.traverse((models) => {
        models.material = material
      })
      scenes[state].add(obj)

      if (state) {
        scenes[state].add(atmos2)
        scenes[state].add(light2)
      } else {
        scenes[state].add(atmos)
        scenes[state].add(light)
      }
    })
  }

  const loadStl = (file) => {
    loaders.stl.load(file, (stl) => {
      scenes[state].clear()

      const model = new THREE.Mesh(stl, material)
      scenes[state].add(model)

      if (state) {
        scenes[state].add(atmos2)
        scenes[state].add(light2)
      } else {
        scenes[state].add(atmos)
        scenes[state].add(light)
      }
    })
  }

  if (state === 0) {
    if (SIMPLIFY_FILE.blob) {
      const filename = SIMPLIFY_FILE.name
      const extension = filename.toLowerCase().slice(filename.lastIndexOf('.') + 1, filename.length)
      if (extension === 'obj') {
        const reader = new FileReader()
        reader.addEventListener('load', function (e) {
          const content = e.target.result
          loadObj(content)
        })
        reader.readAsDataURL(SIMPLIFY_FILE.blob)
      } else if (extension === 'stl') {
        const reader = new FileReader()
        reader.addEventListener('load', function (e) {
          const content = e.target.result
          loadStl(content)
        })
        reader.readAsDataURL(SIMPLIFY_FILE.blob)
      } else {
        console.log('Wrong file format, webgl will remain without changes!')
      }
    }
  } else if (state === 1) {
    if (optimizedModel) {
      const filename = SIMPLIFY_FILE.simplify_name
      const extension = filename.toLowerCase().slice(filename.lastIndexOf('.') + 1, filename.length)
      if (extension === 'obj') {
        loadObj(optimizedModel)
      } else if (extension === 'stl') {
        loadStl(optimizedModel)
      } else {
        console.log('Wrong file format, webgl will remain without changes!')
      }
    }
  }
}

canvas = document.getElementById('c')

const content = document.getElementById('content')

function createScene(i) {
  const scene = new THREE.Scene()

  // make a list item
  const element = document.createElement('div')
  element.className = 'list-item'

  const sceneElement = document.createElement('div')
  element.appendChild(sceneElement)

  // the element that represents the area we want to render the scene
  scene.userData.element = sceneElement
  content.appendChild(element)

  const camera = new THREE.PerspectiveCamera(50, aspectRatio, 0.1, 100)
  camera.position.set(2, 3, 5)
  scene.userData.camera = camera

  const controls = new OrbitControls(scene.userData.camera, scene.userData.element)
  controls.enableDamping = true
  controls.autoRotate = true
  controllers.push(controls)

  scene.userData.controls = controls
  scenes.push(scene)
  const updateControls = () => {
    controls.update()
    camera.aspect = aspectRatio
    camera.updateProjectionMatrix()
    requestAnimationFrame(updateControls)
  }
  updateControls()
}

createScene(1)
createScene(2)

scenes[0].add(new THREE.Mesh(new THREE.SphereGeometry(0.5), placeholderMat))
scenes[0].add(atmos)
scenes[0].add(light)

scenes[1].add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), placeholderMat))
scenes[1].add(atmos2)
scenes[1].add(light2)

renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
})
renderer.setClearColor(0x1d1d21)
renderer.setPixelRatio(window.devicePixelRatio)

function animate() {
  render()
  requestAnimationFrame(animate)
}
animate()

function updateSize() {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  aspectRatio = width / 2 / height

  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false)
  }
}

function render() {
  updateSize()

  canvas.style.transform = `translateY(${window.scrollY}px)`

  renderer.setClearColor(0x1d1d21)
  renderer.setScissorTest(false)
  renderer.clear()

  renderer.setClearColor(0x1d1d21)
  renderer.setScissorTest(true)

  scenes.forEach(function (scene) {
    // get the element that is a place holder for where we want to
    // draw the scene
    const element = scene.userData.element

    // get its position relative to the page's viewport
    const rect = element.getBoundingClientRect()

    // check if it's offscreen. If so skip it
    if (
      rect.bottom < 0 ||
      rect.top > renderer.domElement.clientHeight ||
      rect.right < 0 ||
      rect.left > renderer.domElement.clientWidth
    ) {
      return // it's off screen
    }

    // set the viewport
    const width = rect.right - rect.left
    const height = rect.bottom - rect.top
    const left = rect.left
    const bottom = renderer.domElement.clientHeight - rect.bottom

    renderer.setViewport(left, bottom, width, height)
    renderer.setScissor(left, bottom, width, height)

    const camera = scene.userData.camera

    //camera.aspect = width / height; // not changing in this example
    //camera.updateProjectionMatrix();

    //scene.userData.controls.update();

    renderer.render(scene, camera)
  })
}

/*
 * UI Panel
 */

// Toggling the panel
const clicker = document.getElementsByClassName('ui-title')[0]
const uiPanel = document.getElementById('ui-con')
let panelStatus = false

function ui() {
  if (panelStatus) {
    uiPanel.style.height = 'auto'
    clicker.classList.add('opened_ui')
    panelStatus = false
  } else {
    uiPanel.style.height = '31px'
    clicker.classList.remove('opened_ui')
    panelStatus = true
  }
}

clicker.addEventListener('click', ui)

// Putting the log fullscreen on duble click
const logUI = document.getElementById('simplify_box')

logUI.addEventListener('dblclick', () => {
  logUI.requestFullscreen()
})

// Auto rotate?
const autoRotateCheck = document.getElementById('rotate')

autoRotateCheck.addEventListener('input', (e) => {
  const state = e.target.checked
  controllers.forEach((controller) => {
    controller.autoRotate = state
  })
})

// Smooth Shadings?
const smooth = document.getElementById('smooth')

smooth.addEventListener('input', (e) => {
  const state = e.target.checked
  
  material.flatShading = state ? false : true
  material.needsUpdate = true
})
