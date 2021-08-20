"use strict";

import * as THREE from 'three';

import { BasicGroup } from "./BasicGroup.js";
import { PointCloudTree } from "../pointcloud/PointCloudTree.js";
import { PointCloudOctreeNode } from "../pointcloud/PointCloudOctree.js";
import { PointCloudArena4DNode } from "../pointcloud/PointCloudArena4D.js";
import { PointSizeType, PointColorType } from "../Potree.js";
import { Global } from "../Global.js";
import { WebGLTexture } from "../WebGLTexture.js";

class Group extends BasicGroup {
  constructor() {
    super();

    this.textures = new Map();
  }

  /**
   * Update the potree group before rendering.
   */
  onBeforeRender(renderer, scene, camera, geometry, material, group) {
    super.onBeforeRender(renderer, scene, camera, geometry, material, group);

    var result = this.fetchOctrees();

    for (var octree of result.octrees) {
      var nodes = octree.visibleNodes;
      this.prepareOcttree(renderer, octree, nodes, camera);
    }
  }

  fetchOctrees() {
    var octrees = [];
    var stack = [this];

    while (stack.length > 0) {
      var node = stack.pop();

      if (node instanceof PointCloudTree) {
        octrees.push(node);
        continue;
      }

      var visibleChildren = node.children.filter(c => c.visible);
      stack.push(...visibleChildren);
    }

    var result =
    {
      octrees: octrees
    };

    return result;
  }

  renderNodes(renderer, octree, nodes, visibilityTextureData, camera, shader) {
    var material = octree.material;
    var view = camera.matrixWorldInverse;

    var worldView = new THREE.Matrix4();

    for (var node of nodes) {
      if (Global.debug.allowedNodes !== undefined) {
        if (!Global.debug.allowedNodes.includes(node.name)) {
          continue;
        }
      }

      var world = node.sceneNode.matrixWorld;
      worldView.multiplyMatrices(view, world);

      var vnStart = undefined;
      if (visibilityTextureData) {
        vnStart = visibilityTextureData.offsets.get(node);
      } else {
      }

      var level = node.getLevel();

      var isLeaf;
      if (node instanceof PointCloudOctreeNode) {
        isLeaf = Object.keys(node.children).length === 0;
      }
      else if (node instanceof PointCloudArena4DNode) {
        isLeaf = node.geometryNode.isLeaf;
      }

      material.uniforms.uVNStart.value = vnStart;
      material.uniforms.uIsLeafNode.value = isLeaf;
      material.uniforms.modelMatrix.value = world;
      material.uniforms.modelViewMatrix.value = worldView;
      material.uniforms.uLevel.value = level;
      material.uniforms.uNodeSpacing.value = node.geometryNode.estimatedSpacing;
      material.uniforms.uPCIndex.value = i;
      material.uniformsNeedUpdate = true;
    }
  }

  prepareOcttree(renderer, octree, nodes, camera) {
    var gl = renderer.getContext();
    var material = octree.material;
    var viewInv = camera.matrixWorld;
    var proj = camera.projectionMatrix;

    var visibilityTextureData = null;

    if (material.pointSizeType === PointSizeType.ADAPTIVE || material.pointColorType === PointColorType.LOD) {
      visibilityTextureData = octree.computeVisibilityTextureData(nodes, camera);

      var vnt = material.visibleNodesTexture;
      vnt.image.data.set(visibilityTextureData.data);
      vnt.needsUpdate = true;
    }

    for (var uniformName of Object.keys(material.uniforms)) {
      var uniform = material.uniforms[uniformName];

      if (uniform.type == "t") {
        var texture = uniform.value;

        if (!texture) {
          continue;
        }

        if (!this.textures.has(texture)) {
          var webglTexture = new WebGLTexture(gl, texture);
          this.textures.set(texture, webglTexture);
        }

        var webGLTexture = this.textures.get(texture);
        webGLTexture.update();
      }
    }

    // Clip planes
    var numClippingPlanes = (material.clipping && material.clippingPlanes && material.clippingPlanes.length) ? material.clippingPlanes.length : 0;
    var clipPlanesChanged = material.defines['num_clipplanes'] !== numClippingPlanes;
    var clippingPlanes = [];
    if (clipPlanesChanged) {
      material.defines = {
        ...material.defines,
        num_clipplanes: numClippingPlanes
      };
      material.needsUpdate = true;
    }
    if (numClippingPlanes > 0) {
      var planes = material.clippingPlanes;
      var flattenedPlanes = new Array(4 * material.clippingPlanes.length);
      for (var i = 0; i < planes.length; i++) {
        flattenedPlanes[4*i + 0] = planes[i].normal.x;
        flattenedPlanes[4*i + 1] = planes[i].normal.y;
        flattenedPlanes[4*i + 2] = planes[i].normal.z;
        flattenedPlanes[4*i + 3] = planes[i].constant;
      }
      clippingPlanes = flattenedPlanes;
    }

    const clippingPlanesAsVec4Array = material.clippingPlanes ? material.clippingPlanes.map(x => new THREE.Vector4(x.normal.x, x.normal.y, x.normal.z, x.constant)) : [];
    material.uniforms.projectionMatrix.value.copy(proj);
    material.uniforms.uViewInv.value.copy(viewInv);
    material.uniforms.clipPlanes.value = clippingPlanesAsVec4Array;
    material.uniforms.fov.value = Math.PI * camera.fov / 180;
    material.uniforms.near.value = camera.near;
    material.uniforms.far.value = camera.far;
    material.uniforms.size.value = material.size;
    material.uniforms.uOctreeSpacing.value = material.spacing;
    material.uniforms.uColor.value = material.color;
    material.uniforms.uOpacity.value = material.opacity;
    material.uniforms.elevationRange.value = material.elevationRange;
    material.uniforms.intensityRange.value = material.intensityRange;
    material.uniforms.intensityGamma.value = material.intensityGamma;
    material.uniforms.intensityContrast.value = material.intensityContrast;
    material.uniforms.intensityBrightness.value = material.intensityBrightness;
    material.uniforms.rgbGamma.value = material.rgbGamma;
    material.uniforms.rgbBrightness.value = material.rgbBrightness;
    material.uniforms.uTransition.value = material.transition;
    material.uniforms.wRGB.value = material.weightRGB;
    material.uniforms.wIntensity.value = material.weightIntensity;
    material.uniforms.wElevation.value = material.weightElevation;
    material.uniforms.wClassification.value = material.weightClassification;
    material.uniforms.wReturnNumber.value = material.weightReturnNumber;
    material.uniforms.wSourceID.value = material.weightSourceID;
    material.uniforms.logDepthBufFC.value = renderer.capabilities.logarithmicDepthBuffer ? 2.0 / (Math.log(camera.far + 1.0) / Math.LN2) : undefined;
    material.uniformsNeedUpdate = true;
  }
};

export { Group };
