// Simple three.js example

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { MeshoptSimplifier } from 'meshoptimizer'
// import { GUI } from 'lil-gui';

const params = { ratio: 1, error: 0.01, lockBorder: true }

let mesh, renderer, scene, camera, controls

let srcGeometry, dstGeometry

MeshoptSimplifier.ready.then(() => {
  init()
  animate()
})

function init() {
  // renderer
  renderer = new THREE.WebGLRenderer()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  document.body.appendChild(renderer.domElement)

  // scene
  scene = new THREE.Scene()

  // camera, controls
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000)
  camera.position.set(20, 20, 20)
  controls = new OrbitControls(camera, renderer.domElement)
  scene.add(new THREE.AxesHelper(20))

  // geometry
  srcGeometry = new THREE.TorusKnotGeometry(5, 2.5, 124, 32)

  // mesh
  mesh = new THREE.Mesh(srcGeometry, new THREE.MeshBasicMaterial({ wireframe: true }))
  scene.add(mesh)

  // gui
  // const gui = new GUI();
  // gui.add( params, 'ratio', 0, 1, 0.01 );
  // gui.add( params, 'error', 0, 0.25, 0.0001 );
  // gui.add( params, 'lockBorder' );
  // gui.onChange( simplify );

  document.getElementById('slider').addEventListener('change', (e) => {
    params.ratio = 0.001
    simplify()
  })
}

function simplify() {
  const geo = mesh.geometry
  
  const srcIndexArray = geo.index.array
  const srcPositionArray = geo.attributes.position.array

  const targetCount = 3 * Math.floor((params.ratio * srcIndexArray.length) / 3)

  const [dstIndexArray, error] = MeshoptSimplifier.simplify(
    srcIndexArray,
    srcPositionArray,
    3,
    targetCount,
    params.error,
    params.lockBorder ? ['LockBorder'] : [],
  )

  console.log(`targetCount: ${targetCount}, count: ${dstIndexArray.length}`)

  geo.index.array.set(dstIndexArray)
  geo.index.needsUpdate = true

  geo.setDrawRange(0, dstIndexArray.length)
}

function animate() {
  requestAnimationFrame(animate)

  renderer.render(scene, camera)
}
