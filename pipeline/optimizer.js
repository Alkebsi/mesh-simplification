import * as THREE from 'three'
import DracoEncoderModule from 'three/examples/jsm/libs/draco/draco_encoder.js'
import { DRACOExporter } from 'three/addons/Addons.js'

export default class Optimizer {
  constructor(logs) {
    window.DracoEncoderModule = DracoEncoderModule
    this.domLogger = logs
  }

  /**
   * Automatically Optimize and Download Models
   * @param {Mesh} model
   */
  optimize(model) {
    if(!model) {
      throw new Error('You should pass a mesh to be optimized! There was nothing provided.')
    } else if (!model.isMesh || !model.geometry) {
      throw new Error('The model provided is not of type Mesh or does not have a geometry. Make you sure you assign a three.js mesh object (not a group).')
    }

    const maxSize = this.getMaxSize(model)

    for (let i = 1; i <= 3; i++) {
      const updatedModel = this.mergeByDistance(model, Math.pow(maxSize, 2), i)
      this.log(`Output pass ${i} vertices: ${updatedModel.geometry.attributes.position.count}`)
      this.download(updatedModel, i)
    }
  }
  
  /**
   * Merge Vertices By Distance
   * @param {Mesh} object
   * @param {Number} maxSizeSquared // the squared size of the maximum model size
   * @param {Number} level
   * @return {Mesh}
   */
  mergeByDistance(object, maxSizeSquared, level) {
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

    let resolution = maxSizeSquared * 1e-6

    if (level === 2) {
      resolution = maxSizeSquared * 7e-6
    } else if (level === 3) {
      resolution = maxSizeSquared * 15e-6
    } else {
      // do nothing, set to the default 1 / 3e-6
    }

    object.geometry = clustering(object.geometry, resolution)
    console.log(object.geometry.attributes.position.count)
    return object
  }

  /**
   * Get the Maximum Scale (X|Y|Z) of the Model
   * @param {Mesh} model
   * @return {Number}
   */
  getMaxSize(model) {
    // Getting the size of each child
    const box3 = new THREE.Box3().setFromObject(model)
    const scale = new THREE.Vector3()
    box3.getSize(scale)

    // Set a resulotion
    return Math.max(
      Math.abs(scale.x),
      Math.abs(scale.y),
      Math.abs(scale.z),
    )
  }
  
  // Call this once the file is (re)loaded
  updateLoadedFile(loadedFile) {
    this.loadedFile = loadedFile
  }

  /**
   * Download the files 
   * @param {Mesh} object
   * @param {Number} pass
   * @return {void}
   */
  download(object, pass) {
    const link = document.createElement('a')
    link.style.display = 'none'
    document.body.appendChild(link)

    const downloadFile = (blob, filename) => {
      const downloadable = new Blob([blob], { type: 'application/octet-stream' })
      this.log(`Output pass ${pass} size: ~${Math.round(Number(downloadable.size / 1024)).toLocaleString()}KB`)

      link.href = URL.createObjectURL(downloadable)
      link.download = filename
      link.click()
    }

    const drcExporter = new DRACOExporter()

    if (this.loadedFile) {
      const fullname = this.loadedFile.name
      const extension = fullname.toLowerCase().slice(fullname.lastIndexOf('.') + 1, fullname.length)
      const filename = `pass${pass}-${fullname.replace(extension, 'drc')}`

      const data = drcExporter.parse(object)
      downloadFile(data, filename)
    } else {
      console.log('load a file first!')
    }
  }
  
  /**
   * @param {String} info
   * @param {Boolean} firstCall
   */
  log(info, firstCall = false) {
    // Removing previous logs
    if(firstCall) {
      this.domLogger.innerHTML = ''
    }

    this.domLogger.innerHTML += `<li>${info}</li>`
  }
}