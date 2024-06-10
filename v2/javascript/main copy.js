import * as THREE from 'three'
import { OrbitControls } from 'three/addons/OrbitControls.js'
import { OBJLoader } from 'three/addons/OBJLoader.js'
import { STLLoader } from 'three/addons/STLLoader.js'
import { SimplifyModifier } from 'three/addons/SimplifyModifier.js'

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

// Woring with Three.js
let canvas, renderer, aspectRatio, loadingState

const scenes = []
const loadingMgr = new THREE.LoadingManager(
  () => {
    loadingState = 'ready'
  },
  () => {
    loadingState = 'progress...'
  },
  (url) => {
    loadingState = `error: ${url} has the error`
  },
)

const atmos = new THREE.HemisphereLight(0xaaaaaa, 0x444444, 3)
const light = new THREE.DirectionalLight(0xffffff, 1.5)
light.position.set(1, 1, 1)

const material = new THREE.MeshNormalMaterial({
  flatShading: true,
})

function loader(state) {
  const loaders = {
    obj: new OBJLoader(loadingMgr),
    stl: new STLLoader(loadingMgr),
  }

  const loadModel = (type, file) => {
    let geometry, model, updatedModel

    if (type === 'obj' || type === 'stl') {
      loaders[type].load(file, (object) => {
        scenes[state].clear()

        if (type === 'obj') {
          object.traverse((models) => {
            models.material = material
          })
          model = object
        } else if (type === 'stl') {
          model = new THREE.Mesh(object, material)
        }

        console.log(model, updatedModel)

        scenes[state].add(updatedModel)
        scenes[state].add(model)
        scenes[state].add(atmos)
        scenes[state].add(light)
        console.log(scenes[state])
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

/**
 * else if (extension === 'stl') {
        const reader = new FileReader()
        reader.addEventListener('load', function (e) {
          const content = e.target.result
          loadStl(content)
        })
        reader.readAsDataURL(loadedFile)
      } else {
        console.log('Wrong file format, webgl will remain without changes!')
      }
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

// Loading it form the source
const ggloader = new STLLoader()
ggloader.load('./Cerberus.stl', (mod) => {
  const mesh = new THREE.Mesh(mod, material)
  mesh.scale.setScalar(5)
  scenes[0].add(mesh)

  const modifier = new SimplifyModifier()

  const simplified = mesh.clone()
  simplified.material = simplified.material.clone()
  simplified.material.flatShading = true
  const count = Math.floor(simplified.geometry.attributes.position.count * 0.875) // number of vertices to remove
  // simplified.geometry = modifier.modify(simplified.geometry, count)

  simplified.position.x = 3
  // simplified.rotation.y = -Math.PI / 2
  scenes[0].add(simplified)
})

// scenes[0].add(new THREE.Mesh(new THREE.SphereGeometry(1.5), material))
scenes[0].add(atmos)
scenes[0].add(light)

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
