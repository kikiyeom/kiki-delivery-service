import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"; // glb 파일 로드하기 위함
import { Player } from "./Player";
import { House } from "./House";
import gsap from "gsap"; // animation library

const canvas = document.querySelector("#three-canvas");

/** Renderer */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
// 그림자 사용하기 위한 설정
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default 보다 그림자를 부드럽게 설정함

/** Scene */
const scene = new THREE.Scene();

/** Camera */
// 직교 카메라 사용
// 객체들이 어디있던 간에(가까이, 멀리) 동일한 크기로 보여주는 카메라 -> 게임에서 많이 사용하는 방식
const camera = new THREE.OrthographicCamera(
  -(window.innerWidth / window.innerHeight), // left
  window.innerWidth / window.innerHeight, // right,
  1, // top
  -1, // bottom
  -1000, // near
  1000 // far
);

const cameraPosition = new THREE.Vector3(1, 5, 5);
camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
camera.zoom = 0.25;
camera.updateProjectionMatrix();
scene.add(camera);

/** Light */
// 전체 조명
const ambientLight = new THREE.AmbientLight("white", 0.7);
scene.add(ambientLight);

// 추가 조명
const directionalLight = new THREE.DirectionalLight("white", 0.5);
const directionalLightOriginPosition = new THREE.Vector3(1, 1, 1);
directionalLight.position.x = directionalLightOriginPosition.x;
directionalLight.position.y = directionalLightOriginPosition.y;
directionalLight.position.z = directionalLightOriginPosition.z;
directionalLight.castShadow = true; // true로 해줘야 이 빛을 통해서 그림자를 만들 수 있음

// mapSize 세팅으로 그림자 퀄리티 설정
directionalLight.shadow.mapSize.width = 2048; // 너무 크게 설정하면 페이지 버벅거림, 성능에 영향 줌
directionalLight.shadow.mapSize.height = 2048;
// 그림자 범위
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
directionalLight.shadow.camera.near = -100;
directionalLight.shadow.camera.far = 100;
scene.add(directionalLight);

/** Texture */
const textureLoader = new THREE.TextureLoader();
const floorTexture = textureLoader.load("/images/grid.png");
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
// 크기를 지정해서 반복되도록 설정
floorTexture.repeat.x = 10;
floorTexture.repeat.y = 10;

/** Mesh */
const meshes = [];
const floorMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({
    map: floorTexture,
  })
);
floorMesh.name = "floor";
floorMesh.rotation.x = -Math.PI / 2; // 기본적으로 서 있는 것이라 바닥으로 쓰려면 -90도로 눕혀야 한다.
floorMesh.receiveShadow = true;
scene.add(floorMesh);
meshes.push(floorMesh);

const pointerMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({
    color: "crimson",
    transparent: true,
    opacity: 0.5,
  })
);
pointerMesh.rotation.x = -Math.PI / 2;
pointerMesh.position.y = 0.01;
pointerMesh.receiveShadow = true;
scene.add(pointerMesh);

const spotMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(3, 3),
  new THREE.MeshStandardMaterial({
    color: "yellow",
    transparent: true,
    opacity: 0.5,
  })
);
spotMesh.position.set(5, 0.005, 5);
spotMesh.rotation.x = -Math.PI / 2;
spotMesh.receiveShadow = true;
scene.add(spotMesh);

const gltfLoader = new GLTFLoader();

const house = new House({
  gltfLoader,
  scene,
  modelSrc: "/models/kiki_house.glb",
  x: 5,
  y: -3.3,
  z: 2,
});

const player = new Player({
  scene,
  meshes,
  gltfLoader,
  modelSrc: "/models/kiki.glb",
});

const raycaster = new THREE.Raycaster(); // 바닥을 클릭했을 때 위치를 얻어와서 거기로 키키를 이동 시키기 위함
const mouse = new THREE.Vector2();
const destinationPoint = new THREE.Vector3();
// 키키가 걸어갈 각도
let angle = 0;
let isPressed = false; // 마우스를 누르고 있는 상태

// 그리기
const clock = new THREE.Clock();

function draw() {
  const delta = clock.getDelta();

  if (player.mixer) player.mixer.update(delta); // animation 때문에 사용하는 것 -> update 해줘야 함

  // 체크하는 이유는 로드된 뒤에 실행하기 위함
  if (player.modelMesh) {
    camera.lookAt(player.modelMesh.position); // 카메라가 player.modelMesh를 바라보게 함
  }

  // 체크하는 이유는 로드된 뒤에 실행하기 위함
  if (player.modelMesh) {
    // 마우스 누르고 있는 상태면 광선 쏴라
    if (isPressed) {
      raycasting();
    }

    // 움직인다면
    if (player.moving) {
      // 걸어가는 상태
      // 이동할 각도 계산
      angle = Math.atan2(
        destinationPoint.z - player.modelMesh.position.z, // y
        destinationPoint.x - player.modelMesh.position.x // x
      );
      // 각도를 이용해서 이동시킴
      player.modelMesh.position.x += Math.cos(angle) * 0.05;
      player.modelMesh.position.z += Math.sin(angle) * 0.05;

      // player만 이동시키면 안되고 카메라도 이동시켜야 함
      // 설정안해도 lookat를 해놔서 키키를 따라다니긴 함
      camera.position.x = cameraPosition.x + player.modelMesh.position.x;
      camera.position.z = cameraPosition.z + player.modelMesh.position.z;

      player.action.default.stop(); // 기본 상태 끄고
      player.action.walking.play(); // 걷는 상태 킴

      // 목표하는 위치와 키키의 위치가 특정값보다 작으면 멈춤
      if (
        Math.abs(destinationPoint.x - player.modelMesh.position.x) < 0.03 &&
        Math.abs(destinationPoint.z - player.modelMesh.position.z) < 0.03
      ) {
        player.moving = false;
      }

      // spotMesh는 집 앞에 판
      // spotMesh랑 키키 위치 비교해서 동작할 수 있도록
      if (
        Math.abs(spotMesh.position.x - player.modelMesh.position.x) < 1.5 &&
        Math.abs(spotMesh.position.z - player.modelMesh.position.z) < 1.5
      ) {
        // 안보이면
        if (!house.visible) {
          house.visible = true;
          spotMesh.material.color.set("seagreen");
          // animation libraray 사용
          gsap.to(house.modelMesh.position, {
            duration: 1,
            y: 1,
            ease: "Bounce.easeOut",
          });
          // 카메라 위치 바꿔줌
          gsap.to(camera.position, {
            duration: 1,
            y: 3,
          });
        }
      }
      // 보이면
      else if (house.visible) {
        house.visible = false;
        spotMesh.material.color.set("yellow");
        gsap.to(house.modelMesh.position, {
          duration: 0.5,
          y: -3.3,
        });
        gsap.to(camera.position, {
          duration: 1,
          y: 5,
        });
      }
    } else {
      // 서 있는 상태
      player.action.walking.stop();
      player.action.default.play();
    }
  }

  renderer.render(scene, camera);
  renderer.setAnimationLoop(draw);
}

function checkIntersects() {
  const intersects = raycaster.intersectObjects(meshes);
  for (const item of intersects) {
    // 클릭한 곳이 floor라면
    if (item.object.name === "floor") {
      destinationPoint.x = item.point.x;
      destinationPoint.y = 0.3;
      destinationPoint.z = item.point.z;
      player.modelMesh.lookAt(destinationPoint);

      player.moving = true;

      pointerMesh.position.x = destinationPoint.x;
      pointerMesh.position.z = destinationPoint.z;
    }
    break;
  }
}

function setSize() {
  camera.left = -(window.innerWidth / window.innerHeight);
  camera.right = window.innerWidth / window.innerHeight;
  camera.top = 1;
  camera.bottom = -1;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}

window.addEventListener("resize", setSize);

// 마우스 좌표를 three.js에 맞게 변환
function calculateMousePosition(e) {
  mouse.x = (e.clientX / canvas.clientWidth) * 2 - 1;
  mouse.y = -((e.clientY / canvas.clientHeight) * 2 - 1);
}

// 변환된 마우스 좌표를 이용해 레이캐스팅
function raycasting() {
  raycaster.setFromCamera(mouse, camera);
  checkIntersects();
}

// 마우스 이벤트
canvas.addEventListener("mousedown", (e) => {
  isPressed = true;
  calculateMousePosition(e);
});
canvas.addEventListener("mouseup", () => {
  isPressed = false;
});
canvas.addEventListener("mousemove", (e) => {
  if (isPressed) {
    calculateMousePosition(e);
  }
});

// 터치 이벤트
canvas.addEventListener("touchstart", (e) => {
  isPressed = true;
  calculateMousePosition(e.touches[0]);
});
canvas.addEventListener("touchend", () => {
  isPressed = false;
});
canvas.addEventListener("touchmove", (e) => {
  if (isPressed) {
    calculateMousePosition(e.touches[0]);
  }
});

draw();
