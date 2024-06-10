import * as THREE from 'three'
import { OrbitControls } from 'three/addons/OrbitControls.js'
import { GLTFLoader } from 'three/addons/GLTFLoader.js'
import { OBJLoader } from 'three/addons/OBJLoader.js'
import { STLLoader } from 'three/addons/STLLoader.js'
import { SimplifyModifier } from 'three/addons/SimplifyModifier.js'

let renderer, scene, camera

init()

function init() {
  const info = document.createElement('div')
  info.style.position = 'absolute'
  info.style.top = '10px'
  info.style.width = '100%'
  info.style.textAlign = 'center'
  info.innerHTML =
    '<a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> - Vertex Reduction using SimplifyModifier'
  document.body.appendChild(info)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setClearColor(0xff0000)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000)
  camera.position.z = 15

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.addEventListener('change', render) // use if there is no animation loop


  scene.add(new THREE.AmbientLight(0xffffff, 0.6))

  const light = new THREE.PointLight(0xffffff, 400)
  camera.add(light)
  scene.add(camera)

  new OBJLoader().load('./Cerberus.obj', function (gltf) {
    const mesh = gltf.children[0]
    mesh.position.x = -3
    mesh.rotation.y = Math.PI / 2
    scene.add(mesh)

    const modifier = new SimplifyModifier()

    const simplified = mesh.clone()
    simplified.material = simplified.material.clone()
    simplified.material.flatShading = true
    const count = Math.floor(simplified.geometry.attributes.position.count * 0.875) // number of vertices to remove
    simplified.geometry = modifier.modify(simplified.geometry, count)

    simplified.position.x = 3
    simplified.rotation.y = -Math.PI / 2
    scene.add(simplified)

    render()
  })

  window.addEventListener('resize', onWindowResize)
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight)

  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  render()
}

function render() {
  renderer.render(scene, camera)
}