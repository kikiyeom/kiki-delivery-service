import { AnimationMixer } from "three";

export class Player {
  constructor(info) {
    this.moving = false;

    info.gltfLoader.load(info.modelSrc, (glb) => {
      // 그림자 적용
      glb.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
        }
      });

      this.modelMesh = glb.scene.children[0];
      this.modelMesh.position.y = 0.3;
      this.modelMesh.name = "kiki";
      info.scene.add(this.modelMesh);
      info.meshes.push(this.modelMesh);

      this.action = {
        default: null,
        walking: null,
      };

      this.mixer = new AnimationMixer(this.modelMesh);
      this.action.default = this.mixer.clipAction(glb.animations[0]);
      this.action.walking = this.mixer.clipAction(glb.animations[3]);
      this.action.default.play();
    });
  }
}
