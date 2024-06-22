import './index.css'

// Three.js
import * as THREE from 'three'
import {
  // Loaders
  OBJLoader,
  GLTFLoader,
  STLLoader,
  FBXLoader,
  PLYLoader,
  USDZLoader,
} from 'three/addons/Addons.js'

// Optimizer
import Optimizer from './optimizer.js'

const logger = document.getElementById('log')
const opt = new Optimizer(logger)

/**
 * Main Events
 */
let elapsedTime = 0
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

function timer(start) {
  if (start) {
    elapsedTime = Date.now()
  }
  else {
    elapsedTime -= Date.now()
  }
}

/**
 * Three.js
 */
let canvas, renderer, aspectRatio, initialVertCount, simplifiedVertCount
const modelSize = new THREE.Vector3()
let modelChildrensSize = {}
let sliderValue = null
let model, updatedModel

const scenes = []
const material = new THREE.MeshBasicMaterial({
  side: THREE.DoubleSide,
})

/**
 * Loading Models
 */
function loader(state) {
  const loaders = {
    obj: new OBJLoader(),
    stl: new STLLoader(),
    glb: new GLTFLoader(),
    gltf: new GLTFLoader(),
    fbx: new FBXLoader(),
    ply: new PLYLoader(),
    usdz: new USDZLoader(),
    usdc: new USDZLoader(),
  }

  const loadModel = (type, file) => {
    if (
      type === 'obj' ||
      type === 'stl' ||
      type === 'glb' ||
      type === 'gltf' ||
      type === 'fbx' ||
      type === 'usdz' ||
      type === 'usdc' ||
      type === 'ply'
    ) {
      loaders[type].load(file, (object) => {
        scenes[state].clear()

        if (type === 'obj') {
          object.traverse((models) => {
            models.material = material
          })
          model = object
        } else if (type === 'stl' || type === 'ply') {
          model = new THREE.Mesh(object, material)
        } else if (type === 'glb' || type === 'gltf') {
          object.scene.traverse((models) => {
            models.material = material
          })
          model = object.scene
        } else if (type === 'fbx') {
          object.traverse((models) => {
            models.material = material
          })
          console.error('FBX files are not well supported, yet')
          opt.log('FBX files are not well supported, yet')

          model = object
        } else if (type === 'usdc' || type === 'usdz') {
          console.log(object)
          model = object
        }

        updatedModel = model.clone()

        initialVertCount = 0
        simplifiedVertCount = 0

        modelChildrensSize = []

        updatedModel.traverse((child) => {
          if (child.isMesh) {
            initialVertCount += child.geometry.attributes.position.count
            opt.log(`Input vertices: ${initialVertCount}`)
          }
          if (child.isMesh) {
            opt.optimize(child)
          }
        })

        timer(false)
        opt.log(`Finished in ${Math.abs(Number(elapsedTime)).toLocaleString()}ms. Please, reload the page if you want to upload the same file again.`)
        scenes[state].add(updatedModel)
      })
    } else {
      console.log(`Wrong or unsupported file format. File type: ${type}`)
      opt.log(`Wrong or unsupported file format. File type: .${type} Please, upload .obj .slt or .glb files.`)
    }
  }

  if (state === 0) {
    if (loadedFile) {
      opt.updateLoadedFile(loadedFile)
      opt.log('Loading model...', true)
      opt.log(`Input file name: ${loadedFile.name}`)
      opt.log(`Input file size: ~${Math.round(Number(loadedFile.size / 1024)).toLocaleString()}KB`)
      opt.log(`Getting files ready to be downloaded...`)
      opt.log(`---------Please--Wait----------`)

      timer(true)

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

/**
 * Setting Native Three.js Configs
 */
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

scenes.push(scene)


function animate() {
  render()
  requestAnimationFrame(animate)
}
animate()


function render() {
  canvas.style.transform = `translateY(${window.scrollY}px)`

  scenes.forEach(function (scene) {
    // get the element that is a place holder for where we want to
    // draw the scene
    const element = scene.userData.element

    // get its position relative to the page's viewport
    const rect = element.getBoundingClientRect()

    // set the viewport
    const width = 0
    const height = 0
    const left = 0
    const bottom = 0
  })
}