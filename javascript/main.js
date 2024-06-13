import * as THREE from 'three'
import { OrbitControls } from 'three/addons/OrbitControls.js'
import { OBJLoader } from 'three/addons/OBJLoader.js'
import { GLTFLoader } from 'three/addons/GLTFLoader.js'
import { STLLoader } from 'three/addons/STLLoader.js'
import { FBXLoader } from 'three/addons/FBXLoader.js'
import { PLYLoader } from 'three/addons/PLYLoader.js'
import { USDZLoader } from 'three/addons/USDZLoader.js'

/**
 * Calling Stats.js
 */
const stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

/**
 * Main Events
 */
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

/**
 * Three.js
 */
let canvas, renderer, aspectRatio, initialVertCount, simplifiedVertCount
const modelSize = new THREE.Vector3()
let modelChildrensSize = {}
let sliderValue = null
let model, updatedModel

const scenes = []
const loadingMgr = new THREE.LoadingManager(
  () => {
    // loaded
    updateUI()
  },
  () => {}, // progress
  () => {
    // error
    console.error(`Error while loading your file`)
  },
)

const atmos = new THREE.HemisphereLight(0xaaaaaa, 0x444444, 3)
const light = new THREE.DirectionalLight(0xffffff, 1.5)
light.position.set(1, 1, 1)

const material = new THREE.MeshNormalMaterial({
  flatShading: true,
  side: THREE.DoubleSide,
})

/**
 * Util Functions
 */
// Merge Vertices By Distance
function simplify(object, resolution) {
  // ref: https://github.com/mrdoob/three.js/blob/dev/examples/jsm/utils/BufferGeometryUtils.js
  const clustering = (geometry, tolerance) => {
    tolerance = Math.max(tolerance, Number.EPSILON)
    const hashToIndex = {}
    const indices = geometry.getIndex()
    const positions = geometry.getAttribute('position')
    const vertexCount = indices ? indices.count : positions.count

    let upcommingIndex = 0

    const attrNames = Object.keys(geometry.attributes)
    const tmpAttrs = {}
    const tmpMorphAttrs = {}
    const newI = []
    const get = ['getX', 'getY', 'getZ', 'getW']
    const set = ['setX', 'setY', 'setZ', 'setW']

    for (let i = 0; i < attrNames.length; i++) {
      const name = attrNames[i]
      const attr = geometry.attributes[name]

      tmpAttrs[name] = new THREE.BufferAttribute(
        new attr.array.constructor(attr.count * attr.itemSize),
        attr.itemSize,
        attr.normalized,
      )

      const morphAttr = geometry.morphAttributes[name]
      if (morphAttr) {
        tmpMorphAttrs[name] = new BufferAttribute(
          new morphAttr.array.constructor(morphAttr.count * morphAttr.itemSize),
          morphAttr.itemSize,
          morphAttr.normalized,
        )
      }
    }

    const halfTolerance = tolerance * 0.5
    const ex = Math.log10(1 / tolerance)
    const hasher = Math.pow(10, ex)
    const hashAdd = halfTolerance * hasher
    for (let i = 0; i < vertexCount; i++) {
      const index = indices ? indices.getX(i) : i
      let hash = ''
      for (let j = 0, l = attrNames.length; j < l; j++) {
        const name = attrNames[j]
        const attribute = geometry.getAttribute(name)
        const itemSize = attribute.itemSize

        for (let k = 0; k < itemSize; k++) {
          hash += `${~~(attribute[get[k]](index) * hasher + hashAdd)},`
        }
      }
      if (hash in hashToIndex) {
        newI.push(hashToIndex[hash])
      } else {
        for (let j = 0, l = attrNames.length; j < l; j++) {
          const name = attrNames[j]
          const attribute = geometry.getAttribute(name)
          const morphAttr = geometry.morphAttributes[name]
          const itemSize = attribute.itemSize
          const newarray = tmpAttrs[name]
          const newMorphArrays = tmpMorphAttrs[name]
          for (let k = 0; k < itemSize; k++) {
            const getFunc = get[k]
            const setFunc = set[k]
            newarray[setFunc](upcommingIndex, attribute[getFunc](index))

            if (morphAttr) {
              for (let m = 0, ml = morphAttr.length; m < ml; m++) {
                newMorphArrays[m][setFunc](upcommingIndex, morphAttr[m][getFunc](index))
              }
            }
          }
        }

        hashToIndex[hash] = upcommingIndex
        newI.push(upcommingIndex)
        upcommingIndex++
      }
    }

    // generate result BufferGeometry
    const result = geometry.clone()
    for (const name in geometry.attributes) {
      const tmpAttribute = tmpAttrs[name]

      result.setAttribute(
        name,
        new THREE.BufferAttribute(
          tmpAttribute.array.slice(0, upcommingIndex * tmpAttribute.itemSize),
          tmpAttribute.itemSize,
          tmpAttribute.normalized,
        ),
      )

      if (!(name in tmpMorphAttrs)) continue

      for (let j = 0; j < tmpMorphAttrs[name].length; j++) {
        const tmpMorphAttribute = tmpMorphAttrs[name][j]

        result.morphAttributes[name][j] = new THREE.BufferAttribute(
          tmpMorphAttribute.array.slice(0, upcommingIndex * tmpMorphAttribute.itemSize),
          tmpMorphAttribute.itemSize,
          tmpMorphAttribute.normalized,
        )
      }
    }

    // indices
    result.setIndex(newI)
    return result
  }

  object.geometry = clustering(object.geometry, resolution)
  simplifiedVertCount += object.geometry.attributes.position.count
  return object
}

// Calculating the Bounding Box, scaling and centering the model
function center(model) {
  // model.scale.setScalar(0.05) // TODO: Scale it later accourding to the BoundingBox
  const box3 = new THREE.Box3().setFromObject(model)
  box3.getSize(modelSize)

  // Setting model's size
  // ref: https://stackoverflow.com/questions/51634396/get-the-dimensionssizes-of-a-3d-model-with-js
  const scale = 10
  const maxSize = Math.max(Math.abs(modelSize.x), Math.abs(modelSize.y), Math.abs(modelSize.z))
  model.scale.multiplyScalar(scale / maxSize)

  // Setting the model to center
  const newBox3 = new THREE.Box3().setFromObject(model)
  const newSize = new THREE.Vector3()
  newBox3.getSize(newSize)

  const modelCenter = new THREE.Vector3()
  newBox3.getCenter(modelCenter)
  model.position.set(-modelCenter.x, -modelCenter.y, -modelCenter.z)
}

/**
 * Loading Models
 */
function loader(state) {
  const loaders = {
    obj: new OBJLoader(loadingMgr),
    stl: new STLLoader(loadingMgr),
    glb: new GLTFLoader(loadingMgr),
    gltf: new GLTFLoader(loadingMgr),
    fbx: new FBXLoader(loadingMgr),
    ply: new PLYLoader(loadingMgr),
    usdz: new USDZLoader(loadingMgr),
    usdc: new USDZLoader(loadingMgr),
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
          if (child.isMesh) initialVertCount += child.geometry.attributes.position.count
          if (child.isMesh) {
            // Getting the size of each child
            const box3 = new THREE.Box3().setFromObject(child)
            modelChildrensSize[child.uuid] = new THREE.Vector3()
            box3.getSize(modelChildrensSize[child.uuid])

            // Set a resulotion
            const maxSize = Math.max(
              Math.abs(modelChildrensSize[child.uuid].x),
              Math.abs(modelChildrensSize[child.uuid].y),
              Math.abs(modelChildrensSize[child.uuid].z),
            )

            let res = maxSize / 500
            if (sliderValue) res = maxSize / sliderValue
            else res = maxSize / 500 // Best Option, middle one

            child = simplify(child, res)
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

const camera = new THREE.PerspectiveCamera(50, aspectRatio, 0.001, 10000)
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
  stats.begin()
  render()
  requestAnimationFrame(animate)
  stats.end()
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
 * UI Elements
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
  // resolution = 25e-3 * domMath.value * (e.target.value / 100) + 1e-10
  if (Number(e.target.value) === 1) {
    // Cleanest Mesh / Worst Performance
    sliderValue = 1000
  } else if (Number(e.target.value) === 2) {
    // Cleanest Mesh / Cleanest Performance
    sliderValue = 500
  } else if (Number(e.target.value) === 3) {
    // Worst Mesh / Best Performance
    sliderValue = 300
  }

  // Simplifying the model
  if (updatedModel) {
    scenes[0].remove(updatedModel)

    updatedModel = model.clone()
    initialVertCount = 0
    simplifiedVertCount = 0

    modelChildrensSize = []

    updatedModel.traverse((child) => {
      if (child.isMesh) initialVertCount += child.geometry.attributes.position.count
      if (child.isMesh) {
        // Getting the size of each child
        const box3 = new THREE.Box3().setFromObject(child)
        modelChildrensSize[child.uuid] = new THREE.Vector3()
        box3.getSize(modelChildrensSize[child.uuid])

        // Set a resulotion
        const maxSize = Math.max(
          Math.abs(modelChildrensSize[child.uuid].x),
          Math.abs(modelChildrensSize[child.uuid].y),
          Math.abs(modelChildrensSize[child.uuid].z),
        )

        const res = maxSize / sliderValue
        child = simplify(child, res)
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
  if (!document.fullscreenElement) {
    document.body.requestFullscreen()
    // document.body.webkitRequestFullscreen() // Safari
    // document.body.msRequestFullscreen() // EI
  } else {
    document.exitFullscreen()
    // document.webkitExitFullscreen() // Safari
    // document.msExitFullscreen() // EI
  }
})
