import * as THREE from 'three'
import { OrbitControls } from 'three/addons/OrbitControls.js'
import { OBJLoader } from 'three/addons/OBJLoader.js'
import { GLTFLoader } from 'three/addons/GLTFLoader.js'
import { STLLoader } from 'three/addons/STLLoader.js'
import { mergeVertices } from 'three/addons/BufferGeometryUtils.js'

// Loading Models on Drop
const mainDiv = document.getElementById('content')
let loadedFile = null

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
  dropped(event)
})

function dropped(event) {
  loadedFile = event.dataTransfer.files[0]
  loader(0)
}

document.getElementById('uploadform').addEventListener('change', () => {
  let uploadform = document.getElementById('uploadform')
  loadedFile = uploadform.files[0]
  loader(0)
})

// Woring with Three.js
let canvas, renderer, aspectRatio, initialVertCount, simplifiedVertCount
let resolution = 25e-4
let model, updatedModel


const scenes = []
const loadingMgr = new THREE.LoadingManager(
  () => {
    // loaded
    updateUI()
  },
  () => {}, // progress
  (url) => {
    // error
    console.error(`Error while loading: ${url}`)
  },
)

const atmos = new THREE.HemisphereLight(0xaaaaaa, 0x444444, 3)
const light = new THREE.DirectionalLight(0xffffff, 1.5)
light.position.set(1, 1, 1)

const material = new THREE.MeshNormalMaterial({
  flatShading: true,
})

function simplify(object) {
  object.geometry = mergeVertices(object.geometry, resolution)
  simplifiedVertCount += object.geometry.attributes.position.count
  return object
}

function center(model) {
  model.scale.setScalar(0.05)
  const box3 = new THREE.Box3().setFromObject(model)
  const vector = new THREE.Vector3()
  box3.getCenter(vector)
  model.position.set(-vector.x, -vector.y, -vector.z)
}

function loader(state) {
  const loaders = {
    obj: new OBJLoader(loadingMgr),
    stl: new STLLoader(loadingMgr),
    glb: new GLTFLoader(loadingMgr),
    gltf: new GLTFLoader(loadingMgr),
  }

  const loadModel = (type, file) => {
    if (type === 'obj' || type === 'stl' || type === 'glb' || type === 'gltf') {
      loaders[type].load(file, (object) => {
        scenes[state].clear()

        if (type === 'obj') {
          object.traverse((models) => {
            models.material = material
          })
          model = object
        } else if (type === 'stl') {
          model = new THREE.Mesh(object, material)
        } else if (type === 'glb' || type === 'gltf') {
          object.scene.traverse((models) => {
            models.material = material
          })
          model = object.scene
        }

        updatedModel = model.clone()
        initialVertCount = 0
        simplifiedVertCount = 0

        updatedModel.traverse((child) => {
          if (child.isMesh) initialVertCount += child.geometry.attributes.position.count
          if (child.isMesh) {
            child = simplify(child)
          }
        })

        // Centering Models
        center(updatedModel)

        scenes[state].add(updatedModel)
        // scenes[state].add(model)
        scenes[state].add(atmos)
        scenes[state].add(light)
      })
    } else {
      console.log(`Wrong or unsupported file format. File type: ${type}`)
    }
  }

  if (state === 0) {
    if (loadedFile) {
      const filename = loadedFile.name
      const extension = filename.toLowerCase().slice(filename.lastIndexOf('.') + 1, filename.length)
      const reader = new FileReader()
      reader.addEventListener('load', function (e) {
        const content = e.target.result
        loadModel(extension, content)
      })
      reader.readAsDataURL(loadedFile)
    }
  }
}

canvas = document.getElementById('c')

const content = document.getElementById('content')

// Creating the Three.js scene
const scene = new THREE.Scene()

// make a list item
const element = document.createElement('div')
element.className = 'list-item'

const sceneElement = document.createElement('div')
element.appendChild(sceneElement)

// the element that represents the area we want to render the scene
scene.userData.element = sceneElement
content.appendChild(element)

const camera = new THREE.PerspectiveCamera(50, aspectRatio, 0.1, 10000)
camera.position.set(2, 3, 5)
scene.userData.camera = camera

const controls = new OrbitControls(scene.userData.camera, scene.userData.element)
controls.enableDamping = true
controls.autoRotate = true

scene.userData.controls = controls
scenes.push(scene)
const updateControls = () => {
  controls.update()
  camera.aspect = aspectRatio
  camera.updateProjectionMatrix()
  requestAnimationFrame(updateControls)
}
updateControls()

scenes[0].add(new THREE.Mesh(new THREE.SphereGeometry(1.5), material))
scenes[0].add(atmos)
scenes[0].add(light)

renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
})
renderer.setClearColor(0x1d1d21)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

function animate() {
  render()
  requestAnimationFrame(animate)
}
animate()

function updateSize() {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  aspectRatio = width / height

  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false)
  }
}

function render() {
  updateSize()

  canvas.style.transform = `translateY(${window.scrollY}px)`

  // renderer.setClearColor(0x1d1d21)
  renderer.setScissorTest(false)
  renderer.clear()

  // renderer.setClearColor(0x1d1d21)
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

    renderer.render(scene, camera)
  })
}

/**
 * UI
 */

const domInitialCount = document.getElementById('initial-count-number')
const domSimpleCount = document.getElementById('simple-count-number')
const domReducedCount = document.getElementById('reduced-count-number')
const domMath = document.getElementById('math')

const slider = document.getElementById('slider')
const smooth = document.getElementById('smooth-shading')
const rotate = document.getElementById('auto-rotate')

function updateUI() {
  initialVertCount ? (domInitialCount.innerHTML = Number(initialVertCount).toLocaleString()) : null
  simplifiedVertCount
    ? (domSimpleCount.innerHTML = Number(simplifiedVertCount).toLocaleString())
    : null
  simplifiedVertCount
    ? (domReducedCount.innerHTML = Number(simplifiedVertCount - initialVertCount).toLocaleString())
    : null
}

slider.addEventListener('change', (e) => {
  resolution = 25e-3 * domMath.value * (e.target.value / 100) + 1e-10
  
  if(updatedModel) {
    scenes[0].remove(updatedModel)

    updatedModel = model.clone()
    initialVertCount = 0
    simplifiedVertCount = 0

    updatedModel.traverse((child) => {
      if (child.isMesh) initialVertCount += child.geometry.attributes.position.count
      if (child.isMesh) {
        child = simplify(child)
      }
    })
    center(updatedModel)
    scenes[0].add(updatedModel)
    updateUI()
  }
})

smooth.addEventListener('change', (e) => {
  material.flatShading = !e.target.checked
  material.needsUpdate = true
})

rotate.addEventListener('change', (e) => {
  controls.autoRotate = e.target.checked
})

// Fullscreen
window.addEventListener('dblclick', () => {
  if(!document.fullscreenElement) {
    document.body.requestFullscreen()
    document.body.webkitRequestFullscreen() // Safari
    document.body.msRequestFullscreen() // EI
  } else {
    document.exitFullscreen();
    document.webkitExitFullscreen(); // Safari
    document.msExitFullscreen(); // EI
  }
})