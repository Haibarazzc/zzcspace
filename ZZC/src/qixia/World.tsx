import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as T from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { blossomRandom, buildCourtyard, createPetalGeometry } from './model'
import { landmarks, times, type CameraShot, type TimeOfDay } from './data'

export type WorldProps = { time:TimeOfDay; shot:CameraShot; selected:number; auto:boolean; reduced:boolean; onSelect:(id:number)=>void; onManual:()=>void; onBearing:(degrees:number)=>void; onReady:()=>void }

function Cinema({time}:{time:TimeOfDay}) {
  const {gl,scene,camera,size}=useThree()
  const pipeline=useMemo(()=>{
    const composer=new EffectComposer(gl)
    const render=new RenderPass(scene,camera),bloom=new UnrealBloomPass(new T.Vector2(1,1),.3,.7,1.15),output=new OutputPass()
    composer.addPass(render);composer.addPass(bloom);composer.addPass(output)
    return {composer,bloom,render,output}
  },[gl,scene,camera])
  useEffect(()=>{pipeline.composer.setSize(size.width,size.height)},[pipeline,size])
  useEffect(()=>()=>{pipeline.composer.dispose();pipeline.bloom.dispose();pipeline.render.dispose();pipeline.output.dispose()},[pipeline])
  useFrame((_,dt)=>{
    gl.toneMappingExposure=T.MathUtils.damp(gl.toneMappingExposure,times[time].exposure,2,dt)
    pipeline.bloom.strength=T.MathUtils.damp(pipeline.bloom.strength,time==='night'?.32:time==='dusk'?.25:.19,2,dt)
    pipeline.composer.render(dt)
  },1)
  return null
}

function CameraRig({shot,auto,reduced,onManual,onBearing}:Pick<WorldProps,'shot'|'auto'|'reduced'|'onManual'|'onBearing'>) {
  const controls=useRef<OrbitControlsImpl>(null)
  const {camera,size}=useThree()
  const destination=useRef(new T.Vector3(27,27,39)),target=useRef(new T.Vector3(0,1.8,0)),moving=useRef(false),lastBearing=useRef(0)
  useEffect(()=>{
    let pos:T.Vector3,at=new T.Vector3(0,1.8,0)
    if(shot.focus!==null){const b=landmarks[shot.focus];at.set(b.x,b.height*.36,b.z);const d=Math.max(b.width*2,12);pos=new T.Vector3(b.x+d*.66,b.height*.8+5,b.z+d)}
    else if(shot.mode==='axis'){pos=new T.Vector3(0,12,39);at.set(0,2.8,-1)}
    else if(shot.mode==='top'){pos=new T.Vector3(0,49,.1);at.set(0,0,0)}
    else pos=new T.Vector3(27,27,39)
    if(matchMedia('(max-width:900px)').matches)pos.sub(at).multiplyScalar(1.4).add(at)
    destination.current.copy(pos);target.current.copy(at)
    if(reduced){camera.position.copy(pos);controls.current?.target.copy(at);controls.current?.update()}
    else moving.current=true
  },[shot,camera,reduced,size.width,size.height])
  useFrame((_,dt)=>{
    if(!controls.current)return
    controls.current.autoRotate=auto&&!moving.current&&!reduced
    if(moving.current){const t=1-Math.exp(-dt*3.1);camera.position.lerp(destination.current,t);controls.current.target.lerp(target.current,t);controls.current.update();if(camera.position.distanceTo(destination.current)<.035)moving.current=false}
    const angle=Math.atan2(camera.position.x-controls.current.target.x,camera.position.z-controls.current.target.z)*180/Math.PI
    if(Math.abs(angle-lastBearing.current)>1){lastBearing.current=angle;onBearing(angle)}
  })
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={.075} minDistance={7} maxDistance={100} minPolarAngle={.001} maxPolarAngle={Math.PI/2-.08} autoRotateSpeed={.38} rotateSpeed={.6} zoomSpeed={.7} onStart={()=>{moving.current=false;onManual()}} target={[0,1.8,0]}/>
}

function Petals({reduced}:{reduced:boolean}) {
  const mesh=useRef<T.InstancedMesh>(null),elapsed=useRef(0)
  const geometry=useMemo(createPetalGeometry,[]),dummy=useMemo(()=>new T.Object3D(),[])
  const seeds=useMemo(()=>Array.from({length:210},(_,i)=>({
    x:(blossomRandom(i+21)-.5)*33,z:(blossomRandom(i+412)-.5)*31,
    phase:blossomRandom(i+701)*17,speed:.35+blossomRandom(i+821)*.5,
    size:.11+blossomRandom(i+1501)*.13,spin:blossomRandom(i+922)*Math.PI*2,
  })),[])
  useEffect(()=>{
    if(mesh.current){mesh.current.instanceMatrix.setUsage(T.DynamicDrawUsage);seeds.forEach((_,i)=>mesh.current!.setColorAt(i,new T.Color(i%3?'#ffd8e9':'#fff1f0')))}
    return()=>geometry.dispose()
  },[geometry,seeds])
  useFrame((_,dt)=>{
    if(!mesh.current)return
    if(!reduced)elapsed.current+=Math.min(dt,.05)
    const t=elapsed.current
    seeds.forEach((p,i)=>{
      const y=.8+T.MathUtils.euclideanModulo(p.phase-t*p.speed,17)
      dummy.position.set(p.x+Math.sin(t*.25+p.spin)*1.7,y,p.z+Math.sin(t*.34+p.phase)*.8)
      dummy.rotation.set(p.spin+t*.7,Math.sin(t*.65+p.phase)*.8,p.spin+t*.45)
      dummy.scale.set(p.size,p.size,p.size);dummy.updateMatrix();mesh.current!.setMatrixAt(i,dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate=true
  })
  return <instancedMesh ref={mesh} name="drifting-cherry-petals" args={[geometry,undefined,seeds.length]} frustumCulled={false}>
    <meshStandardMaterial side={T.DoubleSide} roughness={.85} emissive="#d69cb6" emissiveIntensity={.28}/>
  </instancedMesh>
}

function Atmosphere({time,reduced}:{time:TimeOfDay;reduced:boolean}) {
  const sun=useRef<T.DirectionalLight>(null),fill=useRef<T.HemisphereLight>(null)
  const {scene}=useThree()
  const settings=times[time]
  const targetColor=useMemo(()=>new T.Color(settings.background),[settings]),sunColor=useMemo(()=>new T.Color(settings.sun),[settings])
  const sunPosition=useMemo(()=>new T.Vector3(...settings.position),[settings])
  useEffect(()=>{scene.background=new T.Color(settings.background);scene.fog=new T.FogExp2(settings.background,.008);return()=>{scene.fog=null}},[scene])
  useFrame((_,dt)=>{
    if(!(scene.background instanceof T.Color))scene.background=targetColor.clone()
    scene.background.lerp(targetColor,1-Math.exp(-dt*2))
    if(scene.fog instanceof T.FogExp2)scene.fog.color.copy(scene.background as T.Color)
    if(sun.current){sun.current.color.lerp(sunColor,dt*2);sun.current.position.lerp(sunPosition,1-Math.exp(-dt*1.7));sun.current.intensity=T.MathUtils.damp(sun.current.intensity,settings.sunPower,2,dt)}
    if(fill.current)fill.current.intensity=T.MathUtils.damp(fill.current.intensity,settings.ambient,2,dt)
  })
  return <>
    <hemisphereLight ref={fill} args={['#ffe4f0','#847b91',settings.ambient]}/>
    <directionalLight ref={sun} position={settings.position} intensity={settings.sunPower} color={settings.sun} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-far={100} shadow-normalBias={.06} shadow-bias={-.00015}/>
    <directionalLight position={[15,16,-20]} intensity={1.4} color="#d8c4ef"/>
    <Petals reduced={reduced}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.1,0]} receiveShadow><planeGeometry args={[250,250]}/><shadowMaterial color="#21192b" transparent opacity={.18}/></mesh>
  </>
}

function Architecture({time,selected,onSelect,onReady}:Pick<WorldProps,'time'|'selected'|'onSelect'|'onReady'>) {
  const {group,materials}=useMemo(buildCourtyard,[])
  const [hover,setHover]=useState<number|null>(null)
  const {gl}=useThree()
  useEffect(()=>{onReady()},[onReady])
  useEffect(()=>()=>{
    group.traverse(object=>{if(object instanceof T.Mesh){object.geometry.dispose();const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(mat=>{if('map' in mat)(mat.map as T.Texture|null)?.dispose();mat.dispose()})}})
    gl.domElement.style.cursor=''
  },[group,gl])
  useFrame((_,dt)=>{materials.lamp.emissiveIntensity=T.MathUtils.damp(materials.lamp.emissiveIntensity,times[time].lamp,2,dt)})
  const enter=(id:number,event:ThreeEvent<PointerEvent>)=>{event.stopPropagation();setHover(id);gl.domElement.style.cursor='pointer'}
  return <>
    <primitive object={group}/>
    {landmarks.map((b,i)=><group key={b.name} position={[b.x,0,b.z]}>
      <mesh position={[0,b.height/2+.5,0]} onPointerOver={e=>enter(i,e)} onPointerOut={()=>{setHover(null);gl.domElement.style.cursor='grab'}} onClick={e=>{e.stopPropagation();if(e.delta<5)onSelect(i)}}>
        <boxGeometry args={[b.width,b.height,b.depth]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false}/>
      </mesh>
      {(hover===i||selected===i)&&<Html position={[0,b.height+1.05,0]} center distanceFactor={50} zIndexRange={[5,0]} style={{pointerEvents:'none'}}><div className={`qx-pin${selected===i?' is-selected':''}`}><span>{String(i+1).padStart(2,'0')}</span>{b.name}</div></Html>}
    </group>)}
    {[[-3.4,2,9],[3.4,2,9],[0,3,2.4],[0,3,-2.8],[-8.7,5,-7],[8.7,5,-7]].map((p,i)=><pointLight key={i} position={p as [number,number,number]} color="#ffd0b6" intensity={time==='dawn'?2:time==='dusk'?12:22} distance={7} decay={2}/>)}
  </>
}

export default function World(props:WorldProps) {
  return <Canvas shadows dpr={[1,1.5]} camera={{position:[27,27,39],fov:39,near:.2,far:240}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.02;gl.shadowMap.type=T.PCFSoftShadowMap;gl.domElement.style.cursor='grab'}}>
    <Atmosphere time={props.time} reduced={props.reduced}/>
    <Architecture time={props.time} selected={props.selected} onSelect={props.onSelect} onReady={props.onReady}/>
    <CameraRig shot={props.shot} auto={props.auto} reduced={props.reduced} onManual={props.onManual} onBearing={props.onBearing}/>
    <Cinema time={props.time}/>
  </Canvas>
}
